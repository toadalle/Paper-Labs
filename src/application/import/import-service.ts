import { createId } from '../../domain/id.js';
import { ARENA_CREATE_DEFAULTS } from '../../domain/create-defaults.js';
import type { Arena, Entity, EntityTraits } from '../../domain/types.js';
import { strategyRegistry } from '../../domain/strategy/registry.js';
import { canonicalJson, sha256 } from '../../infrastructure/hash.js';
import type { AuditService } from '../../infrastructure/audit/audit-service.js';
import type { Repository } from '../../infrastructure/persistence/repository.js';
import { EntityService } from '../services/entity-service.js';
import { ArenaService, type CreateArenaInput, type PreparedArenaInput } from '../services/arena-service.js';
import { parsePortableDocument } from './parser.js';
import {
  PLPS_FORMAT,
  PLPS_VERSION,
  type ImportAction,
  type ImportChange,
  type ImportContext,
  type ImportOperationView,
  type ImportPlanView,
  type ImportResult,
  type PortableArenaSpec,
  type PortableDocument,
  type PortableEntitySpec
} from './types.js';

interface StoredOperation extends ImportOperationView {
  payload: EntityPayload | ArenaPayload;
  targetFingerprint: string | null;
}
interface EntityPayload {
  kind: 'entity';
  create?: { name?: string; family?: string | null; strategyType?: string; strategyVersion?: number; traits?: EntityTraits };
  patch?: { name?: string; family?: string | null; strategyType?: string; strategyVersion?: number; traits?: EntityTraits };
  variant?: { strategyType: string; strategyVersion: number; traits: EntityTraits };
}
interface ArenaPayload {
  kind: 'arena';
  input: CreateArenaInput;
}
interface StoredPlan {
  view: ImportPlanView;
  document: PortableDocument;
  operations: StoredOperation[];
  used: boolean;
}
interface PreparedOperation { operation: StoredOperation; arena?: PreparedArenaInput }

const PLAN_TTL_MS = 30 * 60 * 1000;

export class PortableImportService {
  private readonly plans = new Map<string, StoredPlan>();

  constructor(
    private readonly repository: Repository,
    private readonly entities: EntityService,
    private readonly arenas: ArenaService,
    private readonly audit: AuditService,
    private readonly providerId: string,
    private readonly historicalFeed: string
  ) {}

  schema(kind?: string | null): Record<string, unknown> {
    const common = {
      format: PLPS_FORMAT as typeof PLPS_FORMAT,
      version: PLPS_VERSION as typeof PLPS_VERSION,
      compatibility: 'PLPS v1 decoder is permanent once shipped.',
      input: 'paste-json',
      strictUnknownFields: true,
      missingMeans: 'unspecified; preserve on patch or use canonical create default when allowed',
      nullMeans: 'explicit clear only where nullable',
      contexts: ['ENTITY_OBJECTS', 'ENTITY_SELECTED', 'ARENA_OBJECTS', 'ARENA_SELECTED']
    };
    if (!kind) return { ...common, kinds: ['entity', 'arena', 'bundle'], endpoints: ['/api/import/preview', '/api/import/apply', '/api/import/schema/:kind'] };
    if (kind === 'entity') {
      return {
        ...common,
        kind: 'entity',
        create: { lifecycle: 'CANDIDATE', configurationStatus: 'DRAFT', strategyRequired: false },
        fields: {
          name: { type: 'string', required: false },
          family: { type: ['string', 'null'], required: false, nullable: true },
          strategy: { type: 'object', required: false, note: 'CREATE with strategy requires explicit type and version. Selected patches may inherit current strategy identity.' }
        },
        strategies: strategyRegistry.list().map(definition => ({
          type: definition.strategyType,
          version: definition.strategyVersion,
          displayName: definition.displayName,
          traits: definition.traitDefinitions
        })),
        protected: ['id', 'createdAt', 'traitHash', 'configurationStatus', 'lifecycleState', 'candidateStatus', 'parentEntityId', 'mutationOperator']
      };
    }
    if (kind === 'arena') {
      return {
        ...common,
        kind: 'arena',
        requiredOnCreate: ['name', 'symbol', 'start', 'end'],
        fields: {
          name: { type: 'string', required: true }, symbol: { type: 'string', required: true },
          timeframe: { type: 'string', enum: ['1Day'], default: ARENA_CREATE_DEFAULTS.timeframe },
          start: { type: 'date-or-iso', required: true }, end: { type: 'date-or-iso', required: true },
          initialCapital: { type: 'number', default: ARENA_CREATE_DEFAULTS.initialCapital },
          warmupBars: { type: 'integer', default: ARENA_CREATE_DEFAULTS.warmupBars },
          executionPolicy: { type: 'object', fields: {
            commissionPerTrade: { type: 'number', default: ARENA_CREATE_DEFAULTS.commissionPerTrade },
            slippageBps: { type: 'number', default: ARENA_CREATE_DEFAULTS.slippageBps }
          }},
          rewardPolicy: { type: 'object', fields: {
            lambda: { type: 'number', default: ARENA_CREATE_DEFAULTS.rewardLambda },
            maxDrawdownGate: { type: 'number', default: ARENA_CREATE_DEFAULTS.maxDrawdownGate },
            minimumTradeCount: { type: 'integer', default: ARENA_CREATE_DEFAULTS.minimumTradeCount }
          }}
        },
        environmentResolved: { provider: this.providerId, feed: this.historicalFeed },
        protected: ['id', 'rootArenaId', 'version', 'marketDataSnapshotIds', 'executionPolicyId', 'rewardPolicyId', 'createdAt']
      };
    }
    if (kind === 'bundle') return { ...common, kind: 'bundle', fields: { objects: { type: 'array', minItems: 1, maxItems: 100, itemKinds: ['entity', 'arena'], aliasRequired: true } }, atomicity: 'Domain object graph and mutation audit are all-or-nothing. Valid prepared MarketDataSnapshots may persist independently if domain commit fails.' };
    throw new Error(`Unknown portable schema kind: ${kind}`);
  }

  preview(rawDocument: unknown, context: ImportContext): ImportPlanView {
    this.prunePlans();
    const document = parsePortableDocument(rawDocument);
    const operations = this.planOperations(document, context);
    const now = Date.now();
    const id = createId('import_plan');
    const publicWithoutHash: Omit<ImportPlanView, 'planHash'> = {
      id,
      format: PLPS_FORMAT,
      version: PLPS_VERSION,
      kind: document.kind,
      context: normalizeContext(context),
      valid: operations.every(item => item.action !== 'BLOCKED'),
      operations: operations.map(stripOperation),
      warnings: document.kind === 'bundle' && operations.some(item => item.objectKind === 'arena')
        ? ['Arena snapshot preparation happens before the atomic domain commit. Valid content-addressed snapshots may persist if the bundle domain commit later fails.']
        : [],
      errors: operations.filter(item => item.action === 'BLOCKED').map(item => item.summary),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PLAN_TTL_MS).toISOString()
    };
    const planHash = sha256(canonicalJson(publicWithoutHash));
    const view: ImportPlanView = { ...publicWithoutHash, planHash };
    this.plans.set(id, { view, document, operations, used: false });
    return structuredClone(view);
  }

  async apply(planId: string, planHash: string, correlationId: string): Promise<ImportResult> {
    this.prunePlans();
    const stored = this.plans.get(planId);
    if (!stored || stored.view.planHash !== planHash) throw new Error('ImportPlan not found or hash mismatch. Preview again.');
    if (stored.used) throw new Error('ImportPlan has already been applied. Preview again.');
    if (!stored.view.valid) throw new Error('Invalid ImportPlan cannot be applied.');
    this.assertFresh(stored.operations);

    const prepared: PreparedOperation[] = [];
    for (const operation of stored.operations) {
      if (operation.objectKind === 'arena' && operation.action !== 'NO_OP' && operation.action !== 'BLOCKED') {
        const payload = operation.payload as ArenaPayload;
        prepared.push({ operation, arena: await this.arenas.prepare(payload.input, correlationId) });
      } else prepared.push({ operation });
    }
    this.assertFresh(stored.operations);

    const result: ImportResult = {
      planId,
      correlationId,
      operations: stored.operations.map(stripOperation),
      createdIds: [], updatedIds: [], createdVersions: [], aliasMap: {}, warnings: [...stored.view.warnings]
    };

    this.repository.withTransaction(() => {
      // Variants execute before mutable patches on the same READY parent so simultaneous metadata changes never leak into variant inheritance.
      const ordered = [...prepared].sort((a, b) => actionPriority(a.operation.action) - actionPriority(b.operation.action));
      for (const item of ordered) this.applyOperation(item, correlationId, result);
      this.audit.record({
        eventType: 'IMPORT_APPLIED',
        actor: { type: 'USER', id: null },
        subject: { type: 'ImportPlan', id: planId },
        correlationId,
        summary: `Applied PLPS v${PLPS_VERSION} ${stored.document.kind} import.`,
        details: {
          planHash,
          documentKind: stored.document.kind,
          operationCount: stored.operations.length,
          actions: stored.operations.map(item => item.action),
          aliases: result.aliasMap
        },
        beforeHash: null,
        afterHash: sha256(canonicalJson({ planId, operations: result.operations, aliasMap: result.aliasMap }))
      });
    });
    stored.used = true;
    return structuredClone(result);
  }

  private planOperations(document: PortableDocument, context: ImportContext): StoredOperation[] {
    const normalized = normalizeContext(context);
    if (document.kind === 'bundle') {
      if (normalized.surface === 'ENTITY_SELECTED' || normalized.surface === 'ARENA_SELECTED') throw new Error('Bundle import is a create/setup operation. Open Import from an Objects panel.');
      return document.spec.objects.map((item, index) => item.kind === 'entity'
        ? this.planEntityCreate(item.spec as PortableEntitySpec, item.alias, `bundle-${index}`)
        : this.planArenaCreate(item.spec as PortableArenaSpec, item.alias, `bundle-${index}`));
    }
    if (document.kind === 'entity') {
      if (normalized.surface === 'ENTITY_OBJECTS') return [this.planEntityCreate(document.spec, null, 'entity-create')];
      if (normalized.surface === 'ENTITY_SELECTED') {
        if (!normalized.targetId) throw new Error('Selected Entity import requires targetId.');
        return this.planEntityPatch(document.spec, normalized.targetId);
      }
      throw new Error('Entity import code must be opened from Entities or a selected Entity.');
    }
    if (normalized.surface === 'ARENA_OBJECTS') return [this.planArenaCreate(document.spec, null, 'arena-create')];
    if (normalized.surface === 'ARENA_SELECTED') {
      if (!normalized.targetId) throw new Error('Selected Arena import requires targetId.');
      return [this.planArenaPatch(document.spec, normalized.targetId)];
    }
    throw new Error('Arena import code must be opened from Arenas or a selected Arena.');
  }

  private planEntityCreate(spec: PortableEntitySpec, alias: string | null, suffix: string): StoredOperation {
    const payload = normalizeEntityCreate(spec);
    const changes = entityCreateChanges(payload);
    return {
      id: `op-${suffix}`,
      objectKind: 'entity', action: 'CREATE', targetId: null, sourceAlias: alias,
      summary: `Create ${payload.name?.trim() || 'a new DRAFT Entity'}.`,
      changes,
      consequences: ['Creates a new CANDIDATE / DRAFT Entity.', 'Import never finalizes DRAFT → READY automatically.'],
      payload: { kind: 'entity', create: payload }, targetFingerprint: null
    };
  }

  private planEntityPatch(spec: PortableEntitySpec, entityId: string): StoredOperation[] {
    const current = this.repository.getEntity(entityId);
    if (!current) throw new Error('Selected Entity not found.');
    const fingerprint = sha256(canonicalJson(current));
    const operations: StoredOperation[] = [];
    const mutablePatch: { name?: string; family?: string | null } = {};
    if (spec.name !== undefined && spec.name.trim() !== current.name) mutablePatch.name = spec.name;
    if (spec.family !== undefined && normalizeFamily(spec.family) !== current.family) mutablePatch.family = spec.family;
    const mutableChanges = entityMetadataChanges(current, mutablePatch);

    if (current.configurationStatus === 'DRAFT') {
      const strategy = resolveDraftStrategyPatch(current, spec);
      const strategyChanges = strategy ? entityStrategyChanges(current, strategy.strategyType, strategy.strategyVersion, strategy.traits, 'MUTABLE') : [];
      const changes = [...mutableChanges, ...strategyChanges];
      if (!changes.length) return [noOp('entity', entityId, 'Entity import produces no changes.', fingerprint)];
      return [{
        id: 'op-entity-patch', objectKind: 'entity', action: 'PATCH', targetId: entityId, sourceAlias: null,
        summary: `Patch DRAFT Entity ${current.name}.`, changes,
        consequences: ['Only supplied fields change.', 'Entity remains DRAFT after import.'],
        payload: { kind: 'entity', patch: { ...mutablePatch, ...(strategy ?? {}) } }, targetFingerprint: fingerprint
      }];
    }

    if (current.configurationStatus === 'READY') {
      if (mutableChanges.length) operations.push({
        id: 'op-entity-metadata', objectKind: 'entity', action: 'PATCH', targetId: entityId, sourceAlias: null,
        summary: `Patch mutable metadata on ${current.name}.`, changes: mutableChanges,
        consequences: ['READY birth traits remain unchanged.'],
        payload: { kind: 'entity', patch: mutablePatch }, targetFingerprint: fingerprint
      });
      const variant = resolveReadyVariant(current, spec);
      if (variant) operations.push({
        id: 'op-entity-variant', objectKind: 'entity', action: 'CREATE_VARIANT', targetId: entityId, sourceAlias: null,
        summary: `Create a DRAFT Variant from ${current.name}.`,
        changes: entityStrategyChanges(current, variant.strategyType, variant.strategyVersion, variant.traits, 'IMMUTABLE'),
        consequences: ['Original READY birth configuration is not mutated.', 'Variant is created as DRAFT and must be finalized explicitly.', 'Simultaneous mutable metadata patches apply only to the original Entity.'],
        payload: { kind: 'entity', variant }, targetFingerprint: fingerprint
      });
      return operations.length ? operations : [noOp('entity', entityId, 'Entity import produces no changes.', fingerprint)];
    }
    return [noOp('entity', entityId, 'Entity import produces no changes.', fingerprint)];
  }

  private planArenaCreate(spec: PortableArenaSpec, alias: string | null, suffix: string): StoredOperation {
    const input = arenaCreateInput(spec, this.historicalFeed);
    const normalized = this.arenas.normalize(input);
    return {
      id: `op-${suffix}`, objectKind: 'arena', action: 'CREATE', targetId: null, sourceAlias: alias,
      summary: `Create Arena ${normalized.name}.`, changes: arenaCreateChanges(normalized),
      consequences: [`Snapshot PREPARE resolves provider ${this.providerId} / feed ${this.historicalFeed}.`, 'Domain object commit occurs only after snapshot preparation succeeds.'],
      payload: { kind: 'arena', input }, targetFingerprint: null
    };
  }

  private planArenaPatch(spec: PortableArenaSpec, arenaId: string): StoredOperation {
    const current = this.repository.getArena(arenaId);
    if (!current) throw new Error('Selected Arena not found.');
    const execution = this.repository.getExecutionPolicy(current.executionPolicyId);
    const reward = this.repository.getRewardPolicy(current.rewardPolicyId);
    if (!execution || !reward) throw new Error('Selected Arena policy provenance is incomplete.');
    const input = mergeArenaPatch(current, execution, reward, spec, this.historicalFeed);
    const normalized = this.arenas.normalize(input);
    const changes = arenaPatchChanges(current, execution, reward, normalized);
    const locked = this.repository.isLocked('arena', arenaId);
    if (!changes.length) return noOp('arena', arenaId, 'Arena import produces no changes.', sha256(canonicalJson(current)));
    return {
      id: 'op-arena-patch', objectKind: 'arena', action: locked ? 'CREATE_VERSION' : 'PATCH', targetId: arenaId, sourceAlias: null,
      summary: locked ? `Create next immutable version of ${current.name}.` : `Patch unused Arena ${current.name} v${current.version}.`,
      changes,
      consequences: [
        locked ? 'Selected Arena is already used; the existing version remains immutable.' : 'Selected Arena is unused and will retain its identity/version.',
        `Snapshot PREPARE resolves provider ${this.providerId} / feed ${this.historicalFeed}.`
      ],
      payload: { kind: 'arena', input: { ...input, baseArenaId: current.id } },
      targetFingerprint: sha256(canonicalJson(current))
    };
  }

  private assertFresh(operations: StoredOperation[]): void {
    for (const operation of operations) {
      if (!operation.targetId || !operation.targetFingerprint) continue;
      const current = operation.objectKind === 'entity' ? this.repository.getEntity(operation.targetId) : this.repository.getArena(operation.targetId);
      if (!current || sha256(canonicalJson(current)) !== operation.targetFingerprint) throw new Error('STALE_IMPORT_PLAN: target changed after preview. Preview again.');
    }
  }

  private applyOperation(item: PreparedOperation, correlationId: string, result: ImportResult): void {
    const operation = item.operation;
    if (operation.action === 'NO_OP') return;
    if (operation.objectKind === 'entity') {
      const payload = operation.payload as EntityPayload;
      if (operation.action === 'CREATE') {
        const entity = this.entities.createImportedDraft(payload.create ?? {}, correlationId);
        result.createdIds.push(entity.id);
        if (operation.sourceAlias) result.aliasMap[operation.sourceAlias] = entity.id;
        return;
      }
      if (operation.action === 'CREATE_VARIANT') {
        if (!operation.targetId || !payload.variant) throw new Error('Invalid CREATE_VARIANT operation.');
        const entity = this.entities.createVariantDraft(operation.targetId, payload.variant, correlationId);
        result.createdIds.push(entity.id);
        if (operation.sourceAlias) result.aliasMap[operation.sourceAlias] = entity.id;
        return;
      }
      if (operation.action === 'PATCH') {
        if (!operation.targetId || !payload.patch) throw new Error('Invalid Entity PATCH operation.');
        const patch = payload.patch;
        if (patch.name !== undefined || patch.family !== undefined) {
          const metadata: { name?: string; family?: string | null } = {};
          if (patch.name !== undefined) metadata.name = patch.name;
          if (patch.family !== undefined) metadata.family = patch.family;
          this.entities.updateMetadata(operation.targetId, metadata, correlationId);
        }
        if (patch.strategyType) {
          if (patch.strategyVersion == null) throw new Error('Entity PATCH strategy version is missing.');
          this.entities.configureDraft(operation.targetId, { strategyType: patch.strategyType, strategyVersion: patch.strategyVersion, traits: patch.traits ?? {} }, correlationId);
        }
        result.updatedIds.push(operation.targetId);
        return;
      }
    }
    const payload = operation.payload as ArenaPayload;
    if (!item.arena) throw new Error('Arena operation was not prepared.');
    if (operation.action === 'CREATE' || operation.action === 'CREATE_VERSION') {
      const arena = this.arenas.commitPrepared(item.arena, correlationId);
      result.createdIds.push(arena.id);
      if (operation.action === 'CREATE_VERSION') result.createdVersions.push(arena.id);
      if (operation.sourceAlias) result.aliasMap[operation.sourceAlias] = arena.id;
      return;
    }
    if (operation.action === 'PATCH') {
      if (!operation.targetId) throw new Error('Invalid Arena PATCH operation.');
      const arena = this.arenas.patchUnusedPrepared(operation.targetId, item.arena, correlationId);
      result.updatedIds.push(arena.id);
      return;
    }
  }

  private prunePlans(): void {
    const now = Date.now();
    for (const [id, plan] of this.plans) if (Date.parse(plan.view.expiresAt) <= now || plan.used) this.plans.delete(id);
  }
}

function normalizeContext(context: ImportContext): ImportContext {
  const surfaces = ['ENTITY_OBJECTS', 'ENTITY_SELECTED', 'ARENA_OBJECTS', 'ARENA_SELECTED'];
  if (!surfaces.includes(context.surface)) throw new Error('Unsupported import context surface.');
  return { surface: context.surface, targetId: context.targetId?.trim() || null };
}
function stripOperation(operation: StoredOperation): ImportOperationView {
  const { payload: _payload, targetFingerprint: _fingerprint, ...view } = operation;
  return structuredClone(view);
}
function noOp(kind: 'entity' | 'arena', targetId: string, summary: string, fingerprint: string): StoredOperation {
  return { id: `op-${kind}-noop`, objectKind: kind, action: 'NO_OP', targetId, sourceAlias: null, summary, changes: [], consequences: [], payload: kind === 'entity' ? { kind: 'entity' } : { kind: 'arena', input: {} as CreateArenaInput }, targetFingerprint: fingerprint };
}
function actionPriority(action: ImportAction): number { return action === 'CREATE_VARIANT' ? 0 : action === 'PATCH' ? 1 : 2; }
function normalizeFamily(value: string | null | undefined): string | null { if (value == null) return null; return value.trim() || null; }

function normalizeEntityCreate(spec: PortableEntitySpec): { name?: string; family?: string | null; strategyType?: string; strategyVersion?: number; traits?: EntityTraits } {
  const out: { name?: string; family?: string | null; strategyType?: string; strategyVersion?: number; traits?: EntityTraits } = {};
  if (spec.name !== undefined) { if (!spec.name.trim()) throw new Error('$.spec.name: Entity name cannot be empty.'); out.name = spec.name.trim(); }
  if (spec.family !== undefined) out.family = normalizeFamily(spec.family);
  if (spec.strategy) {
    if (!spec.strategy.type || spec.strategy.version == null) throw new Error('$.spec.strategy: Entity CREATE with strategy requires explicit type and version.');
    const definition = strategyRegistry.get(spec.strategy.type, spec.strategy.version);
    const traits = mergeStrategyTraits(definition, {}, spec.strategy.traits ?? {}, true);
    out.strategyType = definition.strategyType; out.strategyVersion = definition.strategyVersion; out.traits = traits;
  }
  return out;
}

function resolveDraftStrategyPatch(current: Entity, spec: PortableEntitySpec): { strategyType: string; strategyVersion: number; traits: EntityTraits } | null {
  if (!spec.strategy) return null;
  let strategyType = spec.strategy.type ?? current.strategyType;
  let strategyVersion = spec.strategy.version ?? current.strategyVersion;
  if (!strategyType || strategyVersion == null) throw new Error('Selected DRAFT Entity has no strategy context. Supply strategy type and version.');
  if (spec.strategy.type && spec.strategy.type !== current.strategyType && spec.strategy.version == null) throw new Error('Changing strategy type requires explicit strategy version.');
  const definition = strategyRegistry.get(strategyType, strategyVersion);
  const same = current.strategyType === definition.strategyType && current.strategyVersion === definition.strategyVersion;
  const base = same ? current.traits : {};
  const traits = mergeStrategyTraits(definition, base, spec.strategy.traits ?? {}, !same);
  return { strategyType: definition.strategyType, strategyVersion: definition.strategyVersion, traits };
}

function resolveReadyVariant(current: Entity, spec: PortableEntitySpec): { strategyType: string; strategyVersion: number; traits: EntityTraits } | null {
  if (!spec.strategy) return null;
  const strategyType = spec.strategy.type ?? current.strategyType;
  const strategyVersion = spec.strategy.version ?? current.strategyVersion;
  if (!strategyType || strategyVersion == null) throw new Error('READY Entity strategy identity is incomplete.');
  if (spec.strategy.type && spec.strategy.type !== current.strategyType && spec.strategy.version == null) throw new Error('Changing strategy type requires explicit strategy version.');
  const definition = strategyRegistry.get(strategyType, strategyVersion);
  const same = current.strategyType === definition.strategyType && current.strategyVersion === definition.strategyVersion;
  const traits = mergeStrategyTraits(definition, same ? current.traits : {}, spec.strategy.traits ?? {}, !same);
  if (same && canonicalJson(traits) === canonicalJson(current.traits)) return null;
  return { strategyType: definition.strategyType, strategyVersion: definition.strategyVersion, traits };
}

function mergeStrategyTraits(definition: ReturnType<typeof strategyRegistry.get>, base: EntityTraits, patch: EntityTraits, includeDefaults: boolean): EntityTraits {
  const allowed = new Set(definition.traitDefinitions.map(item => item.key));
  for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new Error(`strategy.traits.${key}: unknown trait for ${definition.strategyType} v${definition.strategyVersion}.`);
  const defaults = includeDefaults ? Object.fromEntries(definition.traitDefinitions.map(item => [item.key, item.default])) as EntityTraits : {};
  return strategyRegistry.validate(definition.strategyType, definition.strategyVersion, { ...defaults, ...base, ...patch }).traits;
}

function entityCreateChanges(payload: ReturnType<typeof normalizeEntityCreate>): ImportChange[] {
  const changes: ImportChange[] = [];
  if (payload.name !== undefined) changes.push(change('name', null, payload.name, 'CREATE'));
  if (payload.family !== undefined) changes.push(change('family', null, payload.family, 'CREATE'));
  if (payload.strategyType) {
    changes.push(change('strategy.type', null, payload.strategyType, 'CREATE'), change('strategy.version', null, payload.strategyVersion, 'CREATE'));
    for (const [key, value] of Object.entries(payload.traits ?? {})) changes.push(change(`strategy.traits.${key}`, null, value, 'CREATE'));
  }
  return changes;
}
function entityMetadataChanges(current: Entity, patch: { name?: string; family?: string | null }): ImportChange[] {
  const out: ImportChange[] = [];
  if (patch.name !== undefined && patch.name.trim() !== current.name) out.push(change('name', current.name, patch.name.trim(), 'MUTABLE'));
  if (patch.family !== undefined && normalizeFamily(patch.family) !== current.family) out.push(change('family', current.family, normalizeFamily(patch.family), 'MUTABLE'));
  return out;
}
function entityStrategyChanges(current: Entity, type: string, version: number, traits: EntityTraits, classification: 'MUTABLE' | 'IMMUTABLE'): ImportChange[] {
  const out: ImportChange[] = [];
  if (current.strategyType !== type) out.push(change('strategy.type', current.strategyType, type, classification));
  if (current.strategyVersion !== version) out.push(change('strategy.version', current.strategyVersion, version, classification));
  const keys = new Set([...Object.keys(current.traits), ...Object.keys(traits)]);
  for (const key of keys) if (canonicalJson(current.traits[key]) !== canonicalJson(traits[key])) out.push(change(`strategy.traits.${key}`, current.traits[key], traits[key], classification));
  return out;
}

function arenaCreateInput(spec: PortableArenaSpec, feed: string): CreateArenaInput {
  if (!spec.name?.trim()) throw new Error('$.spec.name: Arena CREATE requires name.');
  if (!spec.symbol?.trim()) throw new Error('$.spec.symbol: Arena CREATE requires symbol.');
  if (!spec.start?.trim()) throw new Error('$.spec.start: Arena CREATE requires start.');
  if (!spec.end?.trim()) throw new Error('$.spec.end: Arena CREATE requires end.');
  const out: CreateArenaInput = { name: spec.name, symbol: spec.symbol, start: spec.start, end: spec.end, feed };
  if (spec.timeframe !== undefined) out.timeframe = spec.timeframe;
  if (spec.initialCapital !== undefined) out.initialCapital = spec.initialCapital;
  if (spec.warmupBars !== undefined) out.warmupBars = spec.warmupBars;
  if (spec.executionPolicy?.commissionPerTrade !== undefined) out.commissionPerTrade = spec.executionPolicy.commissionPerTrade;
  if (spec.executionPolicy?.slippageBps !== undefined) out.slippageBps = spec.executionPolicy.slippageBps;
  if (spec.rewardPolicy?.lambda !== undefined) out.rewardLambda = spec.rewardPolicy.lambda;
  if (spec.rewardPolicy?.maxDrawdownGate !== undefined) out.maxDrawdownGate = spec.rewardPolicy.maxDrawdownGate;
  if (spec.rewardPolicy?.minimumTradeCount !== undefined) out.minimumTradeCount = spec.rewardPolicy.minimumTradeCount;
  return out;
}
function mergeArenaPatch(current: Arena, execution: NonNullable<ReturnType<Repository['getExecutionPolicy']>>, reward: NonNullable<ReturnType<Repository['getRewardPolicy']>>, spec: PortableArenaSpec, feed: string): CreateArenaInput {
  return {
    name: spec.name ?? current.name,
    symbol: spec.symbol ?? current.symbolUniverse[0] ?? '',
    timeframe: spec.timeframe ?? current.timeframe,
    start: spec.start ?? current.timeWindow.start,
    end: spec.end ?? current.timeWindow.end,
    initialCapital: spec.initialCapital ?? current.initialCapital,
    warmupBars: spec.warmupBars ?? current.warmupBars,
    commissionPerTrade: spec.executionPolicy?.commissionPerTrade ?? execution.commissionPerTrade,
    slippageBps: spec.executionPolicy?.slippageBps ?? execution.slippageBps,
    rewardLambda: spec.rewardPolicy?.lambda ?? reward.lambda,
    maxDrawdownGate: spec.rewardPolicy?.maxDrawdownGate ?? reward.maxDrawdownGate,
    minimumTradeCount: spec.rewardPolicy?.minimumTradeCount ?? reward.minimumTradeCount,
    feed
  };
}
function arenaCreateChanges(input: ReturnType<ArenaService['normalize']>): ImportChange[] {
  return [
    change('name', null, input.name, 'CREATE'), change('symbol', null, input.symbol, 'CREATE'), change('timeframe', null, input.timeframe, 'CREATE'),
    change('start', null, input.start, 'CREATE'), change('end', null, input.end, 'CREATE'), change('initialCapital', null, input.initialCapital, 'CREATE'),
    change('warmupBars', null, input.warmupBars, 'CREATE'), change('executionPolicy.commissionPerTrade', null, input.commissionPerTrade, 'CREATE'),
    change('executionPolicy.slippageBps', null, input.slippageBps, 'CREATE'), change('rewardPolicy.lambda', null, input.rewardLambda, 'CREATE'),
    change('rewardPolicy.maxDrawdownGate', null, input.maxDrawdownGate, 'CREATE'), change('rewardPolicy.minimumTradeCount', null, input.minimumTradeCount, 'CREATE'),
    change('environment.provider', null, 'resolved at apply', 'ENVIRONMENT')
  ];
}
function arenaPatchChanges(current: Arena, execution: NonNullable<ReturnType<Repository['getExecutionPolicy']>>, reward: NonNullable<ReturnType<Repository['getRewardPolicy']>>, next: ReturnType<ArenaService['normalize']>): ImportChange[] {
  const pairs: Array<[string, unknown, unknown]> = [
    ['name', current.name, next.name], ['symbol', current.symbolUniverse[0] ?? '', next.symbol], ['timeframe', current.timeframe, next.timeframe],
    ['start', current.timeWindow.start, next.start], ['end', current.timeWindow.end, next.end], ['initialCapital', current.initialCapital, next.initialCapital],
    ['warmupBars', current.warmupBars, next.warmupBars], ['executionPolicy.commissionPerTrade', execution.commissionPerTrade, next.commissionPerTrade],
    ['executionPolicy.slippageBps', execution.slippageBps, next.slippageBps], ['rewardPolicy.lambda', reward.lambda, next.rewardLambda],
    ['rewardPolicy.maxDrawdownGate', reward.maxDrawdownGate, next.maxDrawdownGate], ['rewardPolicy.minimumTradeCount', reward.minimumTradeCount, next.minimumTradeCount]
  ];
  return pairs.filter(([,a,b]) => canonicalJson(a) !== canonicalJson(b)).map(([path,a,b]) => change(path,a,b,'MUTABLE'));
}
function change(path: string, oldValue: unknown, newValue: unknown, classification: ImportChange['classification']): ImportChange { return { path, oldValue, newValue, classification }; }
