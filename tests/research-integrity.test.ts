import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ResearchIntegrityService } from '../src/application/services/research-integrity-service.js';
import { requireResearchValid } from '../src/application/services/research-validity.js';
import { AuditService } from '../src/infrastructure/audit/audit-service.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';
import type { Arena, Experience, MarketDataSnapshot } from '../src/domain/types.js';

const snapshot: MarketDataSnapshot = {
  id: 'snapshot_1', version: 1, provider: 'fake', feed: 'test', symbolUniverse: ['SPY'], timeframe: '1Day',
  requestedStart: '2026-01-01T00:00:00.000Z', requestedEnd: '2026-01-03T00:00:00.000Z',
  actualStart: '2026-01-02T00:00:00.000Z', actualEnd: '2026-01-02T00:00:00.000Z', adjustmentMode: 'split',
  coverageMetadata: {}, providerMetadata: {}, fetchedAt: '2026-01-03T00:00:00.000Z', contentHash: 'a'.repeat(64),
  schemaVersion: 1, status: 'VALID', supersedesSnapshotId: null, artifactPath: 'data/test.json'
};
const arena: Arena = {
  id: 'arena_1', rootArenaId: 'arena_1', version: 1, name: 'A', marketDataSnapshotIds: [snapshot.id], symbolUniverse: ['SPY'],
  timeframe: '1Day', initialCapital: 10000, warmupBars: 20,
  timeWindow: { start: snapshot.requestedStart, end: snapshot.requestedEnd }, executionPolicyId: 'execution_policy_1', rewardPolicyId: 'reward_policy_1', executionCostModel: { commissionPerTrade: 0, slippageBps: 1 },
  scoringConfig: { rewardPolicyVersion: 'reward_v1', hardGatePolicyVersion: 'gate_v1' }, createdAt: snapshot.fetchedAt
};
const experience: Experience = {
  id: 'experience_1', entityId: 'entity_1', arenaVersionId: arena.id, marketDataSnapshotIds: [snapshot.id], evolutionRunId: null,
  evolutionPolicyVersionId: null, evaluationSuiteVersionId: null, startedAt: snapshot.fetchedAt, completedAt: snapshot.fetchedAt,
  status: 'COMPLETED', reward: 1, excessReturn: 1, maxDrawdown: 0, hardGatePassed: true, hardGateFailures: [], policyVersions: {}, researchValidity: 'VALID'
};

test('COMPROMISED snapshot atomically invalidates referencing Experiences and is audited', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-integrity-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const integrity = new ResearchIntegrityService(repo, audit);
  try {
    repo.saveMarketDataSnapshot(snapshot); repo.saveArena(arena); repo.saveExperience(experience);
    const result = integrity.compromiseSnapshot(snapshot.id, 'known ingestion defect', 'corr_1');
    assert.deepEqual(result.affectedExperienceIds, [experience.id]);
    assert.equal(repo.getMarketDataSnapshot(snapshot.id)?.status, 'COMPROMISED');
    assert.equal(repo.getExperience(experience.id)?.researchValidity, 'COMPROMISED_SOURCE');
    assert.equal(repo.listAuditEvents().some(event => event.eventType === 'EXPERIENCE_RESEARCH_VALIDITY_COMPROMISED'), true);
    assert.throws(() => requireResearchValid([repo.getExperience(experience.id)!], 'Promotion'), /compromised/);
    assert.equal(audit.verify().valid, true);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('SUPERSEDED snapshot does not invalidate historical Experience', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-integrity-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  try {
    repo.saveMarketDataSnapshot(snapshot); repo.saveArena(arena); repo.saveExperience(experience);
    repo.transitionMarketDataSnapshotStatus(snapshot.id, 'SUPERSEDED');
    assert.equal(repo.getExperience(experience.id)?.researchValidity, 'VALID');
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});
