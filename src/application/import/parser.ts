import type { EntityTraits } from '../../domain/types.js';
import {
  PLPS_FORMAT,
  PLPS_VERSION,
  type PortableArenaSpec,
  type PortableBundleObject,
  type PortableBundleSpec,
  type PortableDocument,
  type PortableEntitySpec,
  type PortableEntityStrategySpec
} from './types.js';

const envelopeKeys = new Set(['format', 'version', 'kind', 'spec']);
const entityKeys = new Set(['name', 'family', 'strategy']);
const strategyKeys = new Set(['type', 'version', 'traits']);
const arenaKeys = new Set(['name', 'symbol', 'timeframe', 'start', 'end', 'initialCapital', 'warmupBars', 'executionPolicy', 'rewardPolicy']);
const executionKeys = new Set(['commissionPerTrade', 'slippageBps']);
const rewardKeys = new Set(['lambda', 'maxDrawdownGate', 'minimumTradeCount']);
const bundleKeys = new Set(['objects']);
const bundleObjectKeys = new Set(['alias', 'kind', 'spec']);
const protectedCommon = new Set([
  'id', 'createdAt', 'updatedAt', 'traitHash', 'originRun', 'originRunId', 'parentEntityId', 'candidateState',
  'candidateStatus', 'researchValidity', 'auditId', 'auditIds', 'snapshotHash', 'snapshotHashes', 'tombstone',
  'tombstoneId', 'marketDataSnapshotIds', 'rootArenaId', 'versionNumber', 'lifecycleState', 'configurationStatus',
  'birthEvolutionRunId', 'evolutionRunId', 'mutationOperator', 'retiredAt'
]);

export function parsePortableDocument(input: unknown): PortableDocument {
  let value = input;
  if (typeof input === 'string') {
    try { value = JSON.parse(input) as unknown; }
    catch { throw new Error('Import code is not valid JSON.'); }
  }
  const root = object(value, '$');
  rejectUnknown(root, envelopeKeys, '$');
  for (const key of Object.keys(root)) if (protectedCommon.has(key)) throw new Error(`$.${key}: protected field is not portable.`);
  if (root.format !== PLPS_FORMAT) throw new Error(`$.format: expected "${PLPS_FORMAT}".`);
  if (root.version !== PLPS_VERSION) throw new Error(`$.version: unsupported PLPS version ${String(root.version)}.`);
  if (root.kind === 'entity') return { format: PLPS_FORMAT, version: PLPS_VERSION, kind: 'entity', spec: parseEntitySpec(root.spec, '$.spec') };
  if (root.kind === 'arena') return { format: PLPS_FORMAT, version: PLPS_VERSION, kind: 'arena', spec: parseArenaSpec(root.spec, '$.spec') };
  if (root.kind === 'bundle') return { format: PLPS_FORMAT, version: PLPS_VERSION, kind: 'bundle', spec: parseBundleSpec(root.spec, '$.spec') };
  throw new Error('$.kind: expected entity, arena, or bundle.');
}

export function parseEntitySpec(input: unknown, path = '$.spec'): PortableEntitySpec {
  const value = object(input, path);
  rejectProtected(value, path);
  rejectUnknown(value, entityKeys, path);
  const out: PortableEntitySpec = {};
  if ('name' in value) {
    if (typeof value.name !== 'string') throw new Error(`${path}.name: expected string.`);
    out.name = value.name;
  }
  if ('family' in value) {
    if (value.family !== null && typeof value.family !== 'string') throw new Error(`${path}.family: expected string or null.`);
    out.family = value.family as string | null;
  }
  if ('strategy' in value) out.strategy = parseStrategySpec(value.strategy, `${path}.strategy`);
  return out;
}

function parseStrategySpec(input: unknown, path: string): PortableEntityStrategySpec {
  const value = object(input, path);
  rejectProtected(value, path);
  rejectUnknown(value, strategyKeys, path);
  const out: PortableEntityStrategySpec = {};
  if ('type' in value) {
    if (typeof value.type !== 'string' || !value.type.trim()) throw new Error(`${path}.type: expected non-empty string.`);
    out.type = value.type.trim();
  }
  if ('version' in value) {
    if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error(`${path}.version: expected positive integer.`);
    out.version = Number(value.version);
  }
  if ('traits' in value) out.traits = parseTraits(value.traits, `${path}.traits`);
  return out;
}

function parseTraits(input: unknown, path: string): EntityTraits {
  const value = object(input, path);
  rejectProtected(value, path);
  const out: EntityTraits = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`${path}.${key}: invalid trait key.`);
    if (nested === null || typeof nested === 'string' || typeof nested === 'boolean' || (typeof nested === 'number' && Number.isFinite(nested))) {
      out[key] = nested;
      continue;
    }
    if (Array.isArray(nested)) {
      const arr = nested.map((item, index) => {
        if (item === null || typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) return item;
        throw new Error(`${path}.${key}[${index}]: unsupported trait value.`);
      });
      out[key] = arr;
      continue;
    }
    throw new Error(`${path}.${key}: unsupported trait value.`);
  }
  return out;
}

export function parseArenaSpec(input: unknown, path = '$.spec'): PortableArenaSpec {
  const value = object(input, path);
  rejectProtected(value, path);
  rejectUnknown(value, arenaKeys, path);
  const out: PortableArenaSpec = {};
  for (const key of ['name', 'symbol', 'timeframe', 'start', 'end'] as const) {
    if (key in value) {
      if (typeof value[key] !== 'string') throw new Error(`${path}.${key}: expected string.`);
      out[key] = String(value[key]);
    }
  }
  for (const key of ['initialCapital', 'warmupBars'] as const) {
    if (key in value) {
      if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) throw new Error(`${path}.${key}: expected finite number.`);
      out[key] = Number(value[key]);
    }
  }
  if ('executionPolicy' in value) {
    const nested = object(value.executionPolicy, `${path}.executionPolicy`);
    rejectProtected(nested, `${path}.executionPolicy`);
    rejectUnknown(nested, executionKeys, `${path}.executionPolicy`);
    out.executionPolicy = {};
    for (const key of ['commissionPerTrade', 'slippageBps'] as const) {
      if (key in nested) {
        if (typeof nested[key] !== 'number' || !Number.isFinite(nested[key])) throw new Error(`${path}.executionPolicy.${key}: expected finite number.`);
        out.executionPolicy[key] = Number(nested[key]);
      }
    }
  }
  if ('rewardPolicy' in value) {
    const nested = object(value.rewardPolicy, `${path}.rewardPolicy`);
    rejectProtected(nested, `${path}.rewardPolicy`);
    rejectUnknown(nested, rewardKeys, `${path}.rewardPolicy`);
    out.rewardPolicy = {};
    for (const key of ['lambda', 'maxDrawdownGate', 'minimumTradeCount'] as const) {
      if (key in nested) {
        if (typeof nested[key] !== 'number' || !Number.isFinite(nested[key])) throw new Error(`${path}.rewardPolicy.${key}: expected finite number.`);
        out.rewardPolicy[key] = Number(nested[key]);
      }
    }
  }
  return out;
}

function parseBundleSpec(input: unknown, path: string): PortableBundleSpec {
  const value = object(input, path);
  rejectUnknown(value, bundleKeys, path);
  if (!Array.isArray(value.objects) || value.objects.length === 0) throw new Error(`${path}.objects: expected a non-empty array.`);
  if (value.objects.length > 100) throw new Error(`${path}.objects: bundle exceeds V1 limit of 100 objects.`);
  const aliases = new Set<string>();
  const objects: PortableBundleObject[] = value.objects.map((item, index) => {
    const itemPath = `${path}.objects[${index}]`;
    const row = object(item, itemPath);
    rejectUnknown(row, bundleObjectKeys, itemPath);
    if (typeof row.alias !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(row.alias)) throw new Error(`${itemPath}.alias: invalid portable alias.`);
    if (aliases.has(row.alias)) throw new Error(`${itemPath}.alias: duplicate alias ${row.alias}.`);
    aliases.add(row.alias);
    if (row.kind === 'entity') return { alias: row.alias, kind: 'entity', spec: parseEntitySpec(row.spec, `${itemPath}.spec`) };
    if (row.kind === 'arena') return { alias: row.alias, kind: 'arena', spec: parseArenaSpec(row.spec, `${itemPath}.spec`) };
    throw new Error(`${itemPath}.kind: V1 bundles support entity or arena.`);
  });
  return { objects };
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected object.`);
  return value as Record<string, unknown>;
}

function rejectUnknown(value: Record<string, unknown>, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(value)) {
    if (protectedCommon.has(key)) throw new Error(`${path}.${key}: protected field is not portable.`);
    if (!allowed.has(key)) throw new Error(`${path}.${key}: unknown field.`);
  }
}

function rejectProtected(value: Record<string, unknown>, path: string): void {
  for (const key of Object.keys(value)) if (protectedCommon.has(key)) throw new Error(`${path}.${key}: protected field is not portable.`);
}
