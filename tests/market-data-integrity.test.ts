import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Experience, MarketBar, MarketDataSnapshot } from '../src/domain/types.js';
import { canonicalJson, sha256 } from '../src/infrastructure/hash.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';
import { AuditService } from '../src/infrastructure/audit/audit-service.js';
import { Logger } from '../src/infrastructure/logging/logger.js';
import { ResearchIntegrityService } from '../src/application/services/research-integrity-service.js';
import { MarketDataIntegrityService } from '../src/application/services/market-data-integrity-service.js';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-market-integrity-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const researchIntegrity = new ResearchIntegrityService(repo, audit);
  const logger = new Logger(join(dir, 'logs'));
  const service = new MarketDataIntegrityService(repo, researchIntegrity, logger);
  return { dir, repo, audit, service };
}

function saveSnapshot(repo: Repository, dir: string, body: string): MarketDataSnapshot {
  const artifactPath = join(dir, 'datasets', 'snapshot_1.json');
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, body, 'utf8');
  const snapshot: MarketDataSnapshot = {
    id: 'snapshot_1', version: 1, provider: 'fake', feed: 'test', symbolUniverse: ['SPY'], timeframe: '1Day',
    requestedStart: '2026-01-01T00:00:00.000Z', requestedEnd: '2026-01-03T00:00:00.000Z',
    actualStart: '2026-01-02T00:00:00.000Z', actualEnd: '2026-01-02T00:00:00.000Z', adjustmentMode: 'split',
    coverageMetadata: {}, providerMetadata: {}, fetchedAt: '2026-01-03T00:00:00.000Z', contentHash: sha256(body),
    schemaVersion: 1, status: 'VALID', supersedesSnapshotId: null, artifactPath
  };
  repo.saveMarketDataSnapshot(snapshot);
  return snapshot;
}

function saveExperience(repo: Repository, snapshotId: string): Experience {
  const experience: Experience = {
    id: 'experience_1', entityId: 'entity_1', arenaVersionId: 'arena_1', marketDataSnapshotIds: [snapshotId], evolutionRunId: null,
    evolutionPolicyVersionId: null, evaluationSuiteVersionId: null, startedAt: '2026-01-03T00:00:00.000Z', completedAt: '2026-01-03T00:00:00.000Z',
    status: 'COMPLETED', reward: 1, excessReturn: 1, maxDrawdown: 0, hardGatePassed: true, hardGateFailures: [], policyVersions: {}, researchValidity: 'VALID'
  };
  repo.saveExperience(experience);
  return experience;
}

const bars: MarketBar[] = [
  { time: '2026-01-02T00:00:00.000Z', open: 100, high: 103, low: 99, close: 102, volume: 1000 }
];

test('stored snapshot artifact with matching hash remains valid', async () => {
  const { dir, repo, audit, service } = setup();
  try {
    const body = canonicalJson(bars);
    const snapshot = saveSnapshot(repo, dir, body);
    const result = await service.verifySnapshot(snapshot.id, 'corr_valid');
    assert.equal(result.valid, true);
    assert.equal(result.compromised, false);
    assert.equal(repo.getMarketDataSnapshot(snapshot.id)?.status, 'VALID');
    assert.equal(audit.verify().valid, true);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('changed stored artifact triggers COMPROMISED and invalidates referencing Experiences', async () => {
  const { dir, repo, audit, service } = setup();
  try {
    const body = canonicalJson(bars);
    const snapshot = saveSnapshot(repo, dir, body);
    const experience = saveExperience(repo, snapshot.id);
    writeFileSync(snapshot.artifactPath, canonicalJson([{ ...bars[0]!, close: 999 }]), 'utf8');

    const result = await service.verifySnapshot(snapshot.id, 'corr_corrupt');
    assert.equal(result.valid, false);
    assert.equal(result.compromised, true);
    assert.deepEqual(result.affectedExperienceIds, [experience.id]);
    assert.equal(repo.getMarketDataSnapshot(snapshot.id)?.status, 'COMPROMISED');
    assert.equal(repo.getExperience(experience.id)?.researchValidity, 'COMPROMISED_SOURCE');
    assert.equal(repo.listAuditEvents().some(event => event.eventType === 'MARKET_DATA_SNAPSHOT_COMPROMISED'), true);
    assert.equal(audit.verify().valid, true);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('missing stored artifact triggers COMPROMISED rather than silently passing', async () => {
  const { dir, repo, service } = setup();
  try {
    const body = canonicalJson(bars);
    const snapshot = saveSnapshot(repo, dir, body);
    rmSync(snapshot.artifactPath, { force: true });
    const result = await service.verifySnapshot(snapshot.id, 'corr_missing');
    assert.equal(result.valid, false);
    assert.match(result.reason ?? '', /unreadable/i);
    assert.equal(repo.getMarketDataSnapshot(snapshot.id)?.status, 'COMPROMISED');
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});
