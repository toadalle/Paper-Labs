import type {
  Arena,
  Entity,
  EvaluationSuite,
  EvolutionPolicy,
  Experience,
  MarketBar,
  MarketDataSnapshot
} from './types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEntity(entity: Entity): Entity {
  assert(entity.name.trim().length > 0, 'Entity name is required.');
  if (entity.lifecycleState === 'CANDIDATE') {
    assert(entity.candidateStatus !== null, 'Candidate entities require candidateStatus.');
  } else {
    assert(entity.candidateStatus === null, 'Only Candidate entities may carry candidateStatus.');
    assert(entity.evolutionRunId === null, 'evolutionRunId is meaningful only while the Entity is a Candidate.');
  }
  if (entity.configurationStatus === 'READY') {
    assert(Boolean(entity.strategyType?.trim()), 'READY Entity requires strategyType.');
    assert(Number.isInteger(entity.strategyVersion) && (entity.strategyVersion ?? 0) >= 1, 'READY Entity requires strategyVersion.');
    assert(Boolean(entity.traitHash && entity.traitHash.length === 64), 'READY Entity requires a SHA-256 traitHash.');
  } else {
    assert(entity.traitHash === null, 'DRAFT Entity cannot carry a finalized traitHash.');
  }
  if (entity.lifecycleState === 'RETIRED') {
    assert(entity.retiredAt !== null, 'Retired entities require retiredAt.');
  } else {
    assert(entity.retiredAt === null, 'Only Retired entities may carry retiredAt.');
  }
  return entity;
}

export function assertArena(arena: Arena): Arena {
  assert(arena.version >= 1, 'Arena version must be >= 1.');
  assert(arena.name.trim().length > 0, 'Arena name is required.');
  assert(arena.marketDataSnapshotIds.length > 0, 'Arena requires at least one MarketDataSnapshot.');
  assert(arena.symbolUniverse.length === 1, 'V1 Arena requires exactly one tradable symbol.');
  assert(arena.initialCapital > 0, 'Arena initial capital must be > 0.');
  assert(Number.isInteger(arena.warmupBars) && arena.warmupBars >= 0, 'Arena warmupBars must be a non-negative integer.');
  assert(Boolean(arena.executionPolicyId), 'Arena requires ExecutionPolicy.');
  assert(Boolean(arena.rewardPolicyId), 'Arena requires RewardPolicy.');
  assert(Date.parse(arena.timeWindow.start) < Date.parse(arena.timeWindow.end), 'Arena time window is invalid.');
  return arena;
}

export function assertEvaluationSuite(suite: EvaluationSuite): EvaluationSuite {
  const arenaIds = new Set<string>();
  for (const entry of suite.entries) {
    assert(!arenaIds.has(entry.arenaVersionId), 'An Arena version may occupy only one role per EvaluationSuite version.');
    arenaIds.add(entry.arenaVersionId);
  }
  return suite;
}

export function assertExperience(experience: Experience): Experience {
  assert(experience.marketDataSnapshotIds.length > 0, 'Experience must retain its market data snapshot IDs.');
  if (experience.status === 'COMPLETED') {
    assert(experience.completedAt !== null, 'Completed Experience requires completedAt.');
    assert(experience.reward !== null, 'Completed Experience requires Reward.');
    assert(experience.hardGatePassed !== null, 'Completed Experience requires hard-gate outcome.');
  }
  return experience;
}

export function assertEvolutionPolicy(policy: EvolutionPolicy): EvolutionPolicy {
  assert(policy.maxExperiences > 0, 'EvolutionPolicy.maxExperiences is required and must be > 0.');
  assert(policy.maxActivePopulation >= policy.minViablePopulation, 'Max active population must cover minimum viable population.');
  assert(policy.variantProbability >= 0 && policy.mutationProbability >= 0, 'Breeding probabilities cannot be negative.');
  const total = policy.variantProbability + policy.mutationProbability;
  assert(Math.abs(total - 1) < 1e-9, 'Variant and Mutation probabilities must sum to 1.');
  return policy;
}

export function assertMarketDataSnapshot(snapshot: MarketDataSnapshot): MarketDataSnapshot {
  assert(snapshot.version >= 1, 'MarketDataSnapshot version must be >= 1.');
  assert(snapshot.provider.trim().length > 0, 'MarketDataSnapshot provider is required.');
  assert(snapshot.feed.trim().length > 0, 'MarketDataSnapshot feed is required.');
  assert(snapshot.symbolUniverse.length > 0, 'MarketDataSnapshot symbolUniverse is required.');
  assert(snapshot.contentHash.length === 64, 'MarketDataSnapshot contentHash must be SHA-256.');
  assert(snapshot.artifactPath.trim().length > 0, 'MarketDataSnapshot artifactPath is required.');
  return snapshot;
}

export function assertMarketBars(bars: MarketBar[]): MarketBar[] {
  let previous = -Infinity;
  const seen = new Set<string>();
  for (const bar of bars) {
    const time = Date.parse(bar.time);
    assert(Number.isFinite(time), 'Market bar timestamp is invalid.');
    assert(time >= previous, 'Market bars must be sorted by time.');
    previous = time;
    assert(!seen.has(bar.time), 'Market bars must not contain duplicate timestamps.');
    seen.add(bar.time);
    assert([bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite), 'Market bar contains non-finite values.');
    assert(bar.high >= Math.max(bar.open, bar.close, bar.low), 'Market bar high is invalid.');
    assert(bar.low <= Math.min(bar.open, bar.close, bar.high), 'Market bar low is invalid.');
  }
  return bars;
}
