import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EntityService } from '../src/application/services/entity-service.js';
import { executeEvaluationCore, EXECUTION_ENGINE_VERSION } from '../src/application/services/evaluation-service.js';
import { createCandidate } from '../src/domain/factories.js';
import { INDICATOR_LIBRARY_VERSION, simpleMovingAverage } from '../src/domain/strategy/indicators.js';
import { movingAverageCrossStrategy } from '../src/domain/strategy/moving-average-cross.js';
import type { Arena, Entity, ExecutionPolicy, MarketBar, MarketDataSnapshot, RewardPolicy } from '../src/domain/types.js';
import { AuditService } from '../src/infrastructure/audit/audit-service.js';
import { canonicalJson, sha256 } from '../src/infrastructure/hash.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';

function readyEntity(): Entity {
  const base = createCandidate({ name: 'MAC' });
  const traits = { fast_window: 2, slow_window: 3, target_exposure: 1 };
  return {
    ...base,
    configurationStatus: 'READY',
    strategyType: 'MOVING_AVERAGE_CROSS',
    strategyVersion: 1,
    traits,
    traitHash: sha256(canonicalJson({ strategyType: 'MOVING_AVERAGE_CROSS', strategyVersion: 1, traits }))
  };
}

const executionPolicy: ExecutionPolicy = {
  id: 'execution_policy_1', version: 1, fillModel: 'NEXT_BAR_OPEN', terminalLiquidation: 'FINAL_BAR_CLOSE',
  fractionalShares: true, longOnly: true, commissionPerTrade: 0, slippageBps: 0, maxExposure: 1,
  createdAt: '2026-01-01T00:00:00.000Z'
};
const rewardPolicy: RewardPolicy = {
  id: 'reward_policy_1', version: 1, lambda: 1, benchmark: 'BUY_AND_HOLD', maxDrawdownGate: 0.5,
  minimumTradeCount: 1, maxExposureGate: 1, requireExecutionValidity: true, requireDataIntegrity: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};
const arena: Arena = {
  id: 'arena_1', rootArenaId: 'arena_1', version: 1, name: 'Fixture', marketDataSnapshotIds: ['snapshot_1'],
  symbolUniverse: ['TEST'], timeframe: '1Day', initialCapital: 1000, warmupBars: 2,
  timeWindow: { start: '2026-01-03T00:00:00.000Z', end: '2026-01-06T23:59:59.999Z' },
  executionPolicyId: executionPolicy.id, rewardPolicyId: rewardPolicy.id,
  executionCostModel: { commissionPerTrade: 0, slippageBps: 0 },
  scoringConfig: { rewardPolicyVersion: '1', hardGatePolicyVersion: '1' }, createdAt: '2026-01-01T00:00:00.000Z'
};

function bars(closes = [10, 10, 11, 12, 13, 12]): MarketBar[] {
  return closes.map((close, index) => ({
    time: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 1000
  }));
}

test('DRAFT Candidate finalizes once and READY birth traits become immutable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-exec-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const service = new EntityService(repo, new AuditService(repo));
  try {
    const draft = service.quickCreate('corr_1');
    assert.equal(draft.configurationStatus, 'DRAFT');
    const ready = service.finalizeConfiguration(draft.id, {
      strategyType: 'MOVING_AVERAGE_CROSS',
      traits: { fast_window: 5, slow_window: 20, target_exposure: 0.75 }
    }, 'corr_2');
    assert.equal(ready.configurationStatus, 'READY');
    assert.equal(ready.traitHash?.length, 64);
    assert.throws(() => service.finalizeConfiguration(draft.id, {}, 'corr_3'), /already finalized/);
    assert.throws(() => repo.saveEntity({ ...ready, traits: { fast_window: 6, slow_window: 20, target_exposure: 0.75 } }), /birth-immutable/);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Moving Average Cross accepts the ordinary 10 / 30 draft configuration', () => {
  const validated = movingAverageCrossStrategy.validateTraits({ fast_window: 10, slow_window: 30, target_exposure: 1 });
  assert.equal(validated.fast_window, 10);
  assert.equal(validated.slow_window, 30);
  assert.equal(validated.target_exposure, 1);
});

test('indicator library is deterministic and versioned', () => {
  assert.equal(INDICATOR_LIBRARY_VERSION, '1.0.0');
  assert.equal(simpleMovingAverage(bars().slice(0, 3), 3), (10 + 10 + 11) / 3);
  assert.equal(simpleMovingAverage(bars().slice(0, 2), 3), null);
  assert.equal(EXECUTION_ENGINE_VERSION, '1.0.0');
});

test('execution is deterministic, next-bar-open, warmup-aware, and terminally liquidated', () => {
  const input = { entity: readyEntity(), arena, executionPolicy, rewardPolicy, strategy: movingAverageCrossStrategy, bars: bars() };
  const a = executeEvaluationCore(input);
  const b = executeEvaluationCore(input);
  assert.deepEqual(a, b);
  assert.equal(a.tracePoints.filter(point => point.isWarmup).length, 2);
  assert.equal(a.tracePoints.filter(point => point.isEvaluated).length, 4);
  const firstDecision = a.events.find(event => event.eventType === 'DECISION_EMITTED');
  const firstFill = a.events.find(event => event.eventType === 'FILL_EXECUTED');
  assert.equal(firstDecision?.timestamp, '2026-01-03T00:00:00.000Z');
  assert.equal(firstFill?.timestamp, '2026-01-04T00:00:00.000Z');
  assert.equal(a.events.at(-2)?.eventType === 'FORCED_LIQUIDATION' || a.events.some(event => event.eventType === 'FORCED_LIQUIDATION'), true);
  assert.equal(a.tracePoints.at(-1)?.quantity, 0);
  assert.equal(Number.isFinite(a.reward), true);
  assert.equal(a.hardGateResults.length, 5);
});

test('future bars cannot change an earlier decision', () => {
  const baseBars = bars();
  const altered = bars();
  altered[5] = { ...altered[5]!, open: 999, high: 1000, low: 998, close: 999 };
  const first = executeEvaluationCore({ entity: readyEntity(), arena, executionPolicy, rewardPolicy, strategy: movingAverageCrossStrategy, bars: baseBars });
  const second = executeEvaluationCore({ entity: readyEntity(), arena, executionPolicy, rewardPolicy, strategy: movingAverageCrossStrategy, bars: altered });
  const decisionsA = first.events.filter(event => event.eventType === 'DECISION_EMITTED');
  const decisionsB = second.events.filter(event => event.eventType === 'DECISION_EMITTED');
  assert.deepEqual(decisionsA.slice(0, 2), decisionsB.slice(0, 2));
});

test('hard-gate failure remains a completed scientific result shape rather than execution failure', () => {
  const strict: RewardPolicy = { ...rewardPolicy, minimumTradeCount: 100 };
  const result = executeEvaluationCore({ entity: readyEntity(), arena, executionPolicy, rewardPolicy: strict, strategy: movingAverageCrossStrategy, bars: bars() });
  assert.equal(result.hardGatePassed, false);
  assert.equal(result.hardGateResults.find(item => item.gate === 'MINIMUM_ACTIVITY')?.passed, false);
  assert.equal(Number.isFinite(result.reward), true);
});

import { ArenaService } from '../src/application/services/arena-service.js';
import { EvaluationService } from '../src/application/services/evaluation-service.js';
import { MarketDataSnapshotService } from '../src/infrastructure/market-data/snapshots.js';
import type { MarketDataProvider, HistoricalBarsRequest, LatestQuoteRequest, SearchAssetsRequest, MarketDataCapabilities } from '../src/infrastructure/market-data/provider.js';
import type { MarketAsset, MarketQuote } from '../src/domain/types.js';

class FixtureProvider implements MarketDataProvider {
  readonly id = 'fixture';
  constructor(private readonly fixtureBars: MarketBar[]) {}
  async capabilities(): Promise<MarketDataCapabilities> {
    return { checkedAt: new Date(0).toISOString(), configured: true, historical: {}, live: {}, assetClasses: ['US_EQUITY'], notes: [] };
  }
  async historicalBars(_request: HistoricalBarsRequest): Promise<MarketBar[]> { return this.fixtureBars.map(item => structuredClone(item)); }
  async latestQuote(_request: LatestQuoteRequest): Promise<MarketQuote> { throw new Error('not used'); }
  async searchAssets(_request: SearchAssetsRequest): Promise<MarketAsset[]> { return []; }
}

class DeferredLoadSnapshotService extends MarketDataSnapshotService {
  readonly loadStarted: Promise<void>;
  private readonly loadRelease: Promise<void>;
  private signalLoadStarted!: () => void;
  private releaseLoad!: () => void;

  constructor(repository: Repository, provider: MarketDataProvider, audit: AuditService, root: string) {
    super(repository, provider, audit, root);
    this.loadStarted = new Promise<void>(resolve => { this.signalLoadStarted = resolve; });
    this.loadRelease = new Promise<void>(resolve => { this.releaseLoad = resolve; });
  }

  override async loadBars(snapshot: MarketDataSnapshot): Promise<MarketBar[]> {
    this.signalLoadStarted();
    await this.loadRelease;
    return super.loadBars(snapshot);
  }

  release(): void {
    this.releaseLoad();
  }
}

test('Arena versions share a family root and completed evaluation persists immutable scientific evidence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-e2e-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const provider = new FixtureProvider(bars());
  const snapshots = new MarketDataSnapshotService(repo, provider, audit, join(dir, 'datasets'));
  const arenas = new ArenaService(repo, snapshots, audit);
  const entities = new EntityService(repo, audit);
  const evaluations = new EvaluationService(repo, snapshots, audit);
  try {
    const draft = entities.quickCreate('e2e_entity_create');
    const entity = entities.finalizeConfiguration(draft.id, {
      strategyType: 'MOVING_AVERAGE_CROSS',
      traits: { fast_window: 2, slow_window: 3, target_exposure: 1 }
    }, 'e2e_entity_ready');
    const firstArena = await arenas.create({
      name: 'Fixture Arena', symbol: 'TEST', start: '2026-01-03', end: '2026-01-06', warmupBars: 2,
      initialCapital: 1000, slippageBps: 0, commissionPerTrade: 0
    }, 'e2e_arena_1');
    const secondArena = await arenas.create({
      baseArenaId: firstArena.id, name: 'Fixture Arena', symbol: 'TEST', start: '2026-01-03', end: '2026-01-06', warmupBars: 2,
      initialCapital: 1000, slippageBps: 0, commissionPerTrade: 0
    }, 'e2e_arena_2');
    assert.equal(firstArena.version, 1);
    assert.equal(secondArena.version, 2);
    assert.equal(secondArena.rootArenaId, firstArena.rootArenaId);

    const result = await evaluations.run(entity.id, secondArena.id, 'e2e_evaluation');
    assert.equal(result.run.status, 'COMPLETED');
    assert.equal(result.experience.status, 'COMPLETED');
    assert.equal(result.experience.indicatorLibraryVersion, INDICATOR_LIBRARY_VERSION);
    assert.equal(result.experience.executionEngineVersion, EXECUTION_ENGINE_VERSION);
    assert.equal(result.experience.arenaVersion, 2);
    assert.deepEqual(result.experience.strategyTraits, entity.traits);
    assert.equal(result.experience.rewardComponents?.reward, result.experience.reward);
    assert.equal(result.experience.marketDataContentHashes?.length, 1);
    assert.equal(result.experience.tradeCount, 1, 'forced terminal liquidation is not counted as strategy activity');
    assert.equal(repo.getExperience(result.experience.id)?.id, result.experience.id);
    assert.equal(repo.getExperienceTrace(result.experience.traceId!)?.points.at(-1)?.quantity, 0);
    assert.equal(repo.listExperienceEventsByExperience(result.experience.id).some(item => item.eventType === 'FORCED_LIQUIDATION'), true);
    assert.equal(repo.isLocked('arena', secondArena.id), true);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('scientific final commit rolls back when required completion AuditEvent fails', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-e2e-audit-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const setupAudit = new AuditService(repo);
  const provider = new FixtureProvider(bars());
  const snapshots = new MarketDataSnapshotService(repo, provider, setupAudit, join(dir, 'datasets'));
  const arenas = new ArenaService(repo, snapshots, setupAudit);
  const entities = new EntityService(repo, setupAudit);
  try {
    const draft = entities.quickCreate('audit_entity_create');
    const entity = entities.finalizeConfiguration(draft.id, {
      strategyType: 'MOVING_AVERAGE_CROSS',
      traits: { fast_window: 2, slow_window: 3, target_exposure: 1 }
    }, 'audit_entity_ready');
    const arenaVersion = await arenas.create({
      name: 'Audit Fixture', symbol: 'TEST', start: '2026-01-03', end: '2026-01-06', warmupBars: 2,
      initialCapital: 1000, slippageBps: 0, commissionPerTrade: 0
    }, 'audit_arena');

    let appendCount = 0;
    const evaluationAudit = new AuditService(repo, () => {
      appendCount += 1;
      if (appendCount === 2) throw new Error('forced completion audit failure');
    });
    const evaluations = new EvaluationService(repo, snapshots, evaluationAudit);
    await assert.rejects(() => evaluations.run(entity.id, arenaVersion.id, 'audit_evaluation'), /forced completion audit failure/);
    assert.equal(repo.listExperiences().length, 0);
    assert.equal(repo.listExperienceTraces().length, 0);
    assert.equal(repo.listExperienceEvents().length, 0);
    assert.equal(repo.isLocked('arena', arenaVersion.id), false);
    assert.equal(repo.listEvaluationRuns().at(0)?.status, 'FAILED');
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('cancelled EvaluationRun produces no Experience', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-cancel-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const snapshots = new MarketDataSnapshotService(repo, new FixtureProvider(bars()), audit, join(dir, 'datasets'));
  const evaluations = new EvaluationService(repo, snapshots, audit);
  try {
    repo.saveEvaluationRun({
      id: 'evaluation_run_cancel', entityId: 'entity_x', arenaVersionId: 'arena_x', status: 'RUNNING',
      createdAt: '2026-01-01T00:00:00.000Z', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null,
      cancelledAt: null, failedAt: null, experienceId: null, failureCode: null, failureMessage: null
    });
    const cancelled = evaluations.cancel('evaluation_run_cancel', 'cancel_corr');
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.experienceId, null);
    assert.equal(repo.listExperiences().length, 0);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('cancelling while an evaluation is awaiting snapshot load preserves CANCELLED and never audits FAILED', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-cancel-race-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const provider = new FixtureProvider(bars());
  const datasetRoot = join(dir, 'datasets');
  const setupSnapshots = new MarketDataSnapshotService(repo, provider, audit, datasetRoot);
  const arenas = new ArenaService(repo, setupSnapshots, audit);
  const entities = new EntityService(repo, audit);
  try {
    const draft = entities.quickCreate('cancel_race_entity_create');
    const entity = entities.finalizeConfiguration(draft.id, {
      strategyType: 'MOVING_AVERAGE_CROSS',
      traits: { fast_window: 2, slow_window: 3, target_exposure: 1 }
    }, 'cancel_race_entity_ready');
    const arenaVersion = await arenas.create({
      name: 'Cancel Race Fixture', symbol: 'TEST', start: '2026-01-03', end: '2026-01-06', warmupBars: 2,
      initialCapital: 1000, slippageBps: 0, commissionPerTrade: 0
    }, 'cancel_race_arena');

    const delayedSnapshots = new DeferredLoadSnapshotService(repo, provider, audit, datasetRoot);
    const evaluations = new EvaluationService(repo, delayedSnapshots, audit);
    const runningPromise = evaluations.run(entity.id, arenaVersion.id, 'cancel_race_run');

    await delayedSnapshots.loadStarted;
    const running = repo.listEvaluationRuns().find(item => item.entityId === entity.id && item.arenaVersionId === arenaVersion.id);
    assert.ok(running, 'run should be persisted before snapshot loading completes');
    assert.equal(running.status, 'RUNNING');

    const cancelled = evaluations.cancel(running.id, 'cancel_race_cancel');
    assert.equal(cancelled.status, 'CANCELLED');
    delayedSnapshots.release();

    await assert.rejects(runningPromise, /no longer active/);
    const persisted = repo.getEvaluationRun(running.id);
    assert.equal(persisted?.status, 'CANCELLED');
    assert.equal(persisted?.experienceId, null);
    assert.equal(repo.listExperiences().length, 0);
    assert.equal(repo.listExperienceEvents().length, 0);
    assert.equal(repo.listExperienceTraces().length, 0);
    const auditTypes = repo.listAuditEvents().map(item => item.eventType);
    assert.equal(auditTypes.includes('EVALUATION_CANCELLED'), true);
    assert.equal(auditTypes.includes('EVALUATION_FAILED'), false);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

