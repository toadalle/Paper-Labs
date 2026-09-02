import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Repository } from '../src/infrastructure/persistence/repository.js';
import { createCandidate, defaultEvolutionPolicy } from '../src/domain/factories.js';
import type { Arena, Experience } from '../src/domain/types.js';

function arena(id = 'arena_1'): Arena {
  return {
    id,
    rootArenaId: id,
    version: 1,
    name: 'Discovery',
    marketDataSnapshotIds: ['snapshot_1'],
    symbolUniverse: ['SPY'],
    timeframe: '1Day',
    initialCapital: 10000,
    warmupBars: 20,
    timeWindow: { start: '2026-01-01T00:00:00.000Z', end: '2026-01-02T00:00:00.000Z' },
    executionPolicyId: 'execution_policy_1',
    rewardPolicyId: 'reward_policy_1',
    executionCostModel: { commissionPerTrade: 0, slippageBps: 1 },
    scoringConfig: { rewardPolicyVersion: 'reward_v1', hardGatePolicyVersion: 'gates_v1' },
    createdAt: '2026-01-01T00:00:00.000Z'
  };
}

function completedExperience(arenaId: string, policyId: string | null = null): Experience {
  return {
    id: 'experience_1',
    entityId: 'entity_1',
    arenaVersionId: arenaId,
    marketDataSnapshotIds: ['snapshot_1'],
    evolutionRunId: null,
    evolutionPolicyVersionId: policyId,
    evaluationSuiteVersionId: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T01:00:00.000Z',
    status: 'COMPLETED',
    reward: 0.1,
    excessReturn: 0.12,
    maxDrawdown: 0.02,
    hardGatePassed: true,
    hardGateFailures: [],
    policyVersions: { reward: 'reward_v1' },
    researchValidity: 'VALID'
  };
}

test('repository persists mutable Entity metadata', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-'));
  const repo = new Repository(join(dir, 'test.sqlite'));
  try {
    const entity = createCandidate({ name: 'Candidate One' });
    repo.saveEntity(entity);
    repo.saveEntity({ ...entity, name: 'Candidate Renamed', family: 'Momentum' });
    assert.equal(repo.getEntity(entity.id)?.name, 'Candidate Renamed');
    assert.equal(repo.getEntity(entity.id)?.family, 'Momentum');
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Entity lineage is immutable at birth while DRAFT traits lock when configuration becomes READY', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-'));
  const repo = new Repository(join(dir, 'test.sqlite'));
  try {
    const entity = createCandidate({ name: 'Child', parentEntityId: 'entity_parent', birthEvolutionRunId: 'run_birth' });
    repo.saveEntity(entity);
    assert.throws(() => repo.saveEntity({ ...entity, parentEntityId: 'entity_other' }), /immutable/);
    assert.throws(() => repo.saveEntity({ ...entity, birthEvolutionRunId: 'run_other' }), /immutable/);
    const draft = repo.saveEntity({ ...entity, traits: { threshold: 2 } });
    assert.equal(draft.traits.threshold, 2);
    const ready = repo.saveEntity({ ...draft, configurationStatus: 'READY', strategyType: 'TEST', strategyVersion: 1, traitHash: 'a'.repeat(64) });
    assert.throws(() => repo.saveEntity({ ...ready, traits: { threshold: 3 } }), /birth-immutable/);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Arena and EvolutionPolicy are editable before scored use and locked by completed Experience', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-'));
  const repo = new Repository(join(dir, 'test.sqlite'));
  try {
    const a = arena();
    repo.saveArena(a);
    repo.saveArena({ ...a, name: 'Discovery Edited' });
    assert.equal(repo.getArena(a.id)?.name, 'Discovery Edited');

    const policy = defaultEvolutionPolicy(12);
    repo.saveEvolutionPolicy(policy);
    repo.saveEvolutionPolicy({ ...policy, minSurvivalAge: 5 });
    assert.equal(repo.getEvolutionPolicy(policy.id)?.minSurvivalAge, 5);

    repo.saveExperience(completedExperience(a.id, policy.id));
    assert.equal(repo.isLocked('arena', a.id), true);
    assert.equal(repo.isLocked('evolution_policy', policy.id), true);
    assert.throws(() => repo.saveArena({ ...a, name: 'Too Late' }), /immutable/);
    assert.throws(() => repo.saveEvolutionPolicy({ ...policy, minSurvivalAge: 6 }), /immutable/);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('completed Experience remains generally immutable while researchValidity has a narrow terminal transition', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-'));
  const repo = new Repository(join(dir, 'test.sqlite'));
  try {
    repo.saveArena(arena());
    const experience = completedExperience('arena_1');
    repo.saveExperience(experience);
    assert.throws(() => repo.saveExperience({ ...experience, reward: 99 }), /immutable/);
    const invalid = repo.transitionExperienceResearchValidity(experience.id, 'COMPROMISED_SOURCE');
    assert.equal(invalid.researchValidity, 'COMPROMISED_SOURCE');
    assert.equal(invalid.reward, 0.1);
    assert.throws(() => repo.transitionExperienceResearchValidity(experience.id, 'VALID'), /terminal/);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('persisted counter is monotonic and does not reuse lower entity totals', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-'));
  const repo = new Repository(join(dir, 'test.sqlite'));
  try {
    assert.equal(repo.reserveCounter('entity_default_name', 0), 1);
    assert.equal(repo.reserveCounter('entity_default_name', 0), 2);
    assert.equal(repo.reserveCounter('entity_default_name', 10), 11);
    assert.equal(repo.reserveCounter('entity_default_name', 1), 12);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});
