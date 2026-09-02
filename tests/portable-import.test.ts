import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PortableImportService } from '../src/application/import/import-service.js';
import { parsePortableDocument } from '../src/application/import/parser.js';
import { EntityService } from '../src/application/services/entity-service.js';
import { ArenaService } from '../src/application/services/arena-service.js';
import type { HistoricalBarsRequest, LatestQuoteRequest, MarketDataCapabilities, MarketDataProvider, SearchAssetsRequest } from '../src/infrastructure/market-data/provider.js';
import type { MarketAsset, MarketBar, MarketQuote } from '../src/domain/types.js';
import { AuditService } from '../src/infrastructure/audit/audit-service.js';
import { MarketDataSnapshotService } from '../src/infrastructure/market-data/snapshots.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';

class ImportFixtureProvider implements MarketDataProvider {
  readonly id = 'fixture-import';
  readonly requests: HistoricalBarsRequest[] = [];
  constructor(private readonly failSymbol: string | null = null) {}
  async capabilities(): Promise<MarketDataCapabilities> { return { checkedAt: new Date(0).toISOString(), configured: true, historical: {}, live: {}, assetClasses: ['US_EQUITY'], notes: [] }; }
  async historicalBars(request: HistoricalBarsRequest): Promise<MarketBar[]> {
    this.requests.push(structuredClone(request));
    if (request.symbol === this.failSymbol) throw new Error(`fixture failure for ${request.symbol}`);
    return Array.from({ length: 260 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 0, 1 + index));
      const close = 100 + index * 0.1;
      return { time: date.toISOString(), open: close, high: close + 1, low: close - 1, close, volume: 1000 };
    });
  }
  async latestQuote(_request: LatestQuoteRequest): Promise<MarketQuote> { throw new Error('not used'); }
  async searchAssets(_request: SearchAssetsRequest): Promise<MarketAsset[]> { return []; }
}

function fixture(failSymbol: string | null = null) {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-import-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const provider = new ImportFixtureProvider(failSymbol);
  const snapshots = new MarketDataSnapshotService(repo, provider, audit, join(dir, 'datasets'));
  const entities = new EntityService(repo, audit);
  const arenas = new ArenaService(repo, snapshots, audit);
  const imports = new PortableImportService(repo, entities, arenas, audit, provider.id, 'iex');
  return { dir, repo, audit, provider, entities, arenas, imports };
}

function entityDoc(spec: Record<string, unknown>) {
  return { format: 'paper-lab', version: 1, kind: 'entity', spec };
}
function arenaDoc(spec: Record<string, unknown>) {
  return { format: 'paper-lab', version: 1, kind: 'arena', spec };
}

function cleanup(value: ReturnType<typeof fixture>): void { value.repo.close(); rmSync(value.dir, { recursive: true, force: true }); }

test('permanent PLPS v1 compatibility fixtures continue decoding', () => {
  for (const name of ['entity-basic.json', 'arena-basic.json', 'bundle-basic.json']) {
    const raw = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'import', 'plps-v1', name), 'utf8');
    const parsed = parsePortableDocument(raw);
    assert.equal(parsed.version, 1);
  }
});

test('PLPS v1 strictly rejects unknown and protected fields', () => {
  assert.throws(() => parsePortableDocument(entityDoc({ naem: 'Typo' })), /unknown field/);
  assert.throws(() => parsePortableDocument(entityDoc({ id: 'entity_external' })), /protected field/);
  assert.throws(() => parsePortableDocument({ format: 'paper-lab', version: 2, kind: 'entity', spec: {} }), /unsupported PLPS version/);
});

test('schema discovery exposes canonical backend Arena defaults and strategy trait schema', () => {
  const x = fixture();
  try {
    const arena = x.imports.schema('arena') as any;
    assert.equal(arena.fields.initialCapital.default, 10000);
    assert.equal(arena.fields.timeframe.default, '1Day');
    const entity = x.imports.schema('entity') as any;
    assert.equal(entity.strategies[0].type, 'MOVING_AVERAGE_CROSS');
    assert.equal(entity.strategies[0].traits.find((item: any) => item.key === 'slow_window').default, 30);
  } finally { cleanup(x); }
});

test('Objects Entity import creates a new DRAFT and requires explicit strategy identity when traits are supplied', async () => {
  const x = fixture();
  try {
    assert.throws(() => x.imports.preview(entityDoc({ strategy: { traits: { slow_window: 50 } } }), { surface: 'ENTITY_OBJECTS' }), /requires explicit type and version/);
    const plan = x.imports.preview(entityDoc({ name: 'Imported MA', strategy: { type: 'MOVING_AVERAGE_CROSS', version: 1, traits: { slow_window: 50 } } }), { surface: 'ENTITY_OBJECTS' });
    const result = await x.imports.apply(plan.id, plan.planHash, 'import_entity');
    const entity = x.repo.getEntity(result.createdIds[0]!);
    assert.equal(entity?.name, 'Imported MA');
    assert.equal(entity?.configurationStatus, 'DRAFT');
    assert.equal(entity?.traits.fast_window, 10);
    assert.equal(entity?.traits.slow_window, 50);
    assert.equal(entity?.traits.target_exposure, 1);
    assert.equal(x.repo.listAuditEvents().some(event => event.eventType === 'IMPORT_APPLIED' && event.correlationId === 'import_entity'), true);
  } finally { cleanup(x); }
});

test('selected DRAFT Entity import recursively patches only supplied traits', async () => {
  const x = fixture();
  try {
    const draft = x.entities.quickCreate('create');
    x.entities.configureDraft(draft.id, { strategyType: 'MOVING_AVERAGE_CROSS', strategyVersion: 1, traits: { fast_window: 10, slow_window: 30, target_exposure: 1 } }, 'configure');
    const plan = x.imports.preview(entityDoc({ strategy: { traits: { slow_window: 50 } } }), { surface: 'ENTITY_SELECTED', targetId: draft.id });
    assert.equal(plan.operations[0]?.action, 'PATCH');
    const result = await x.imports.apply(plan.id, plan.planHash, 'patch_draft');
    assert.deepEqual(result.updatedIds, [draft.id]);
    const patched = x.repo.getEntity(draft.id)!;
    assert.equal(patched.traits.fast_window, 10);
    assert.equal(patched.traits.slow_window, 50);
    assert.equal(patched.traits.target_exposure, 1);
    assert.equal(patched.configurationStatus, 'DRAFT');
  } finally { cleanup(x); }
});

test('READY mixed metadata plus trait import plans PATCH + CREATE_VARIANT without leaking the renamed metadata into the Variant', async () => {
  const x = fixture();
  try {
    const draft = x.entities.quickCreate('create');
    x.entities.updateMetadata(draft.id, { family: 'Original Family' }, 'family');
    const ready = x.entities.finalizeConfiguration(draft.id, { strategyType: 'MOVING_AVERAGE_CROSS', strategyVersion: 1, traits: { fast_window: 10, slow_window: 30, target_exposure: 1 } }, 'ready');
    const plan = x.imports.preview(entityDoc({ name: 'Renamed Original', family: 'New Family', strategy: { traits: { slow_window: 50 } } }), { surface: 'ENTITY_SELECTED', targetId: ready.id });
    assert.deepEqual(plan.operations.map(item => item.action), ['PATCH', 'CREATE_VARIANT']);
    const result = await x.imports.apply(plan.id, plan.planHash, 'mixed');
    const original = x.repo.getEntity(ready.id)!;
    const variant = x.repo.getEntity(result.createdIds[0]!)!;
    assert.equal(original.name, 'Renamed Original');
    assert.equal(original.family, 'New Family');
    assert.equal(original.traits.slow_window, 30);
    assert.equal(variant.parentEntityId, original.id);
    assert.equal(variant.mutationOperator, 'VARIANT');
    assert.equal(variant.configurationStatus, 'DRAFT');
    assert.equal(variant.traits.slow_window, 50);
    assert.equal(variant.family, 'Original Family', 'simultaneous mutable family patch must not leak into Variant inheritance');
    assert.notEqual(variant.name, 'Renamed Original');
  } finally { cleanup(x); }
});

test('ImportPlan stale-target protection rejects apply after selected state changes', async () => {
  const x = fixture();
  try {
    const entity = x.entities.quickCreate('create');
    const plan = x.imports.preview(entityDoc({ name: 'Planned Name' }), { surface: 'ENTITY_SELECTED', targetId: entity.id });
    x.entities.updateMetadata(entity.id, { name: 'Changed Elsewhere' }, 'outside');
    await assert.rejects(() => x.imports.apply(plan.id, plan.planHash, 'apply'), /STALE_IMPORT_PLAN/);
    assert.equal(x.repo.getEntity(entity.id)?.name, 'Changed Elsewhere');
  } finally { cleanup(x); }
});

test('selected unused Arena import patches identity/version while used Arena import creates next immutable version', async () => {
  const x = fixture();
  try {
    const arena = await x.arenas.create({ name: 'Discovery', symbol: 'SPY', start: '2025-03-01', end: '2025-07-01', warmupBars: 10 }, 'arena');
    const unusedPlan = x.imports.preview(arenaDoc({ start: '2025-02-01' }), { surface: 'ARENA_SELECTED', targetId: arena.id });
    assert.equal(unusedPlan.operations[0]?.action, 'PATCH');
    await x.imports.apply(unusedPlan.id, unusedPlan.planHash, 'arena_patch');
    const patched = x.repo.getArena(arena.id)!;
    assert.equal(patched.version, 1);
    assert.equal(patched.timeWindow.start.slice(0, 10), '2025-02-01');

    x.repo.lockArena(arena.id);
    const versionPlan = x.imports.preview(arenaDoc({ start: '2025-01-15', executionPolicy: { slippageBps: 3 } }), { surface: 'ARENA_SELECTED', targetId: arena.id });
    assert.equal(versionPlan.operations[0]?.action, 'CREATE_VERSION');
    const result = await x.imports.apply(versionPlan.id, versionPlan.planHash, 'arena_version');
    const next = x.repo.getArena(result.createdVersions[0]!)!;
    assert.equal(next.rootArenaId, arena.rootArenaId);
    assert.equal(next.version, 2);
    assert.equal(next.timeWindow.start.slice(0, 10), '2025-01-15');
    assert.equal(x.repo.getExecutionPolicy(next.executionPolicyId)?.slippageBps, 3);
    assert.equal(x.repo.getArena(arena.id)?.timeWindow.start.slice(0,10), '2025-02-01');
  } finally { cleanup(x); }
});

test('bundle aliases map to created IDs and domain mutations share one IMPORT_APPLIED correlation', async () => {
  const x = fixture();
  try {
    const bundle = {
      format: 'paper-lab', version: 1, kind: 'bundle', spec: { objects: [
        { alias: 'entity.quick', kind: 'entity', spec: { name: 'Quick Entity' } },
        { alias: 'arena.spy', kind: 'arena', spec: { name: 'SPY Test', symbol: 'SPY', start: '2025-03-01', end: '2025-07-01', warmupBars: 10 } }
      ] }
    };
    const plan = x.imports.preview(bundle, { surface: 'ENTITY_OBJECTS' });
    assert.equal(plan.operations.length, 2);
    const result = await x.imports.apply(plan.id, plan.planHash, 'bundle_apply');
    assert.ok(result.aliasMap['entity.quick']);
    assert.ok(result.aliasMap['arena.spy']);
    assert.equal(x.repo.listEntities().length, 1);
    assert.equal(x.repo.listArenas().length, 1);
    const correlated = x.repo.listAuditEvents().filter(event => event.correlationId === 'bundle_apply');
    assert.equal(correlated.some(event => event.eventType === 'IMPORT_APPLIED'), true);
    assert.equal(correlated.some(event => event.eventType === 'ENTITY_CREATED'), true);
    assert.equal(correlated.some(event => event.eventType === 'ARENA_CREATED'), true);
  } finally { cleanup(x); }
});

test('bundle domain graph stays empty when later snapshot PREPARE fails while earlier valid snapshot evidence may persist', async () => {
  const x = fixture('FAIL');
  try {
    const bundle = {
      format: 'paper-lab', version: 1, kind: 'bundle', spec: { objects: [
        { alias: 'entity.one', kind: 'entity', spec: { name: 'Should Not Commit' } },
        { alias: 'arena.ok', kind: 'arena', spec: { name: 'Okay', symbol: 'SPY', start: '2025-03-01', end: '2025-07-01', warmupBars: 10 } },
        { alias: 'arena.fail', kind: 'arena', spec: { name: 'Fail', symbol: 'FAIL', start: '2025-03-01', end: '2025-07-01', warmupBars: 10 } }
      ] }
    };
    const plan = x.imports.preview(bundle, { surface: 'ARENA_OBJECTS' });
    await assert.rejects(() => x.imports.apply(plan.id, plan.planHash, 'bundle_fail'), /fixture failure/);
    assert.equal(x.repo.listEntities().length, 0);
    assert.equal(x.repo.listArenas().length, 0);
    assert.equal(x.repo.listMarketDataSnapshots().length, 1, 'valid first PREPARE snapshot intentionally survives domain rollback');
    assert.equal(x.repo.listAuditEvents().some(event => event.eventType === 'IMPORT_APPLIED' && event.correlationId === 'bundle_fail'), false);
  } finally { cleanup(x); }
});
