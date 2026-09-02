import test from 'node:test';
import assert from 'node:assert/strict';
import { createCandidate, defaultEvolutionPolicy } from '../src/domain/factories.js';
import { assertEntity, assertEvaluationSuite } from '../src/domain/invariants.js';
import { computeReward } from '../src/domain/reward.js';
import { decideSurvival } from '../src/domain/survival.js';

test('Candidate carries active candidate state', () => {
  const entity = createCandidate({ name: 'Alpha' });
  assert.equal(entity.lifecycleState, 'CANDIDATE');
  assert.equal(entity.candidateStatus, 'ACTIVE');
});

test('non-candidate Entity cannot carry candidate state or evolutionRunId', () => {
  const candidate = createCandidate({ name: 'Alpha', evolutionRunId: 'run_1' });
  assert.throws(() => assertEntity({
    ...candidate,
    lifecycleState: 'PERMANENT',
    candidateStatus: 'ACTIVE'
  }));
  assert.throws(() => assertEntity({
    ...candidate,
    lifecycleState: 'PERMANENT',
    candidateStatus: null
  }));
});

test('EvaluationSuite cannot assign one Arena version to multiple roles', () => {
  assert.throws(() => assertEvaluationSuite({
    id: 'suite_1',
    version: 1,
    name: 'Bad suite',
    createdAt: new Date().toISOString(),
    entries: [
      { arenaVersionId: 'arena_v1', role: 'DISCOVERY' },
      { arenaVersionId: 'arena_v1', role: 'VALIDATION' }
    ]
  }));
});

test('Reward is excess return minus lambda times max drawdown', () => {
  assert.ok(Math.abs(computeReward({ excessReturn: 0.14, maxDrawdown: 0.05, lambda: 1 }) - 0.09) < 1e-12);
});

test('lifespan death occurs before breeding eligibility can matter', () => {
  const result = decideSurvival({
    age: 8,
    recentDiscoveryRewards: [1, 1, 1, 1],
    hardGatePassed: true,
    maxExperiences: 8,
    minSurvivalAge: 4,
    survivalRewardFloor: 0
  });
  assert.deepEqual(result, { result: 'DEAD', reason: 'LIFESPAN', score: null });
});

test('default policy encodes frozen initial population and breeding defaults', () => {
  const policy = defaultEvolutionPolicy(12);
  assert.equal(policy.maxActivePopulation, 64);
  assert.equal(policy.minViablePopulation, 8);
  assert.equal(policy.minBreedingAge, 4);
  assert.equal(policy.breedingTopPercentile, 0.25);
  assert.equal(policy.variantProbability, 0.75);
  assert.equal(policy.mutationProbability, 0.25);
  assert.equal(policy.maxExperiences, 12);
});
