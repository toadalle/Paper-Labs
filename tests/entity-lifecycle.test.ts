import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCandidate } from '../src/domain/factories.js';
import type { Experience } from '../src/domain/types.js';
import { EntityService } from '../src/application/services/entity-service.js';
import { AuditService } from '../src/infrastructure/audit/audit-service.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';

function runningExperience(entityId: string): Experience {
  return {
    id: 'experience_entity_history',
    entityId,
    arenaVersionId: 'arena_missing',
    marketDataSnapshotIds: ['snapshot_history'],
    evolutionRunId: null,
    evolutionPolicyVersionId: null,
    evaluationSuiteVersionId: null,
    startedAt: '2026-09-01T12:00:00.000Z',
    completedAt: null,
    status: 'RUNNING',
    reward: null,
    excessReturn: null,
    maxDrawdown: null,
    hardGatePassed: null,
    hardGateFailures: [],
    policyVersions: {},
    researchValidity: 'VALID'
  };
}

test('Entity must retire before delete and every delete creates an immutable tombstone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-entity-delete-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const entities = new EntityService(repo, audit);
  try {
    const entity = createCandidate({ name: 'Disposable Candidate' });
    repo.saveEntity(entity);
    assert.throws(() => entities.deleteRetired(entity.id, 'corr_delete_early'), /retired before deletion/i);

    const retired = entities.retire(entity.id, 'corr_retire');
    assert.equal(retired.lifecycleState, 'RETIRED');
    assert.equal(retired.candidateStatus, null);
    assert.equal(retired.evolutionRunId, null);
    assert.ok(retired.retiredAt);

    const tombstone = entities.deleteRetired(entity.id, 'corr_delete');
    assert.equal(repo.getEntity(entity.id), null);
    assert.deepEqual(repo.getEntityTombstone(entity.id), tombstone);
    assert.deepEqual(repo.getEntityHistoricalIdentity(entity.id), tombstone);
    assert.equal(tombstone.lifecycleAtDeletion, 'RETIRED');
    assert.equal(tombstone.lastKnownName, 'Disposable Candidate');
    assert.throws(() => repo.saveEntityTombstone({ ...tombstone, lastKnownName: 'Rewritten' }), /immutable/);

    const eventTypes = repo.listAuditEvents().map(event => event.eventType);
    assert.deepEqual(eventTypes, ['ENTITY_RETIRED', 'ENTITY_DELETED']);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Entity deletion preserves historical records instead of cascading research evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-entity-history-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const entities = new EntityService(repo, new AuditService(repo));
  try {
    const entity = createCandidate({ name: 'Historied Candidate' });
    repo.saveEntity(entity);
    repo.saveExperience(runningExperience(entity.id));
    entities.retire(entity.id, 'corr_retire');
    entities.deleteRetired(entity.id, 'corr_delete');

    assert.equal(repo.getEntity(entity.id), null);
    assert.ok(repo.getEntityTombstone(entity.id));
    assert.equal(repo.getExperience('experience_entity_history')?.entityId, entity.id);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Entity delete rolls back tombstone/removal when required AuditEvent append fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-entity-delete-audit-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  try {
    const entity = createCandidate({ name: 'Rollback Candidate' });
    repo.saveEntity(entity);
    const normal = new EntityService(repo, new AuditService(repo));
    normal.retire(entity.id, 'corr_retire');

    const failing = new EntityService(repo, new AuditService(repo, () => { throw new Error('audit unavailable'); }));
    assert.throws(() => failing.deleteRetired(entity.id, 'corr_delete'), /audit unavailable/);
    assert.equal(repo.getEntity(entity.id)?.lifecycleState, 'RETIRED');
    assert.equal(repo.getEntityTombstone(entity.id), null);
    assert.equal(repo.listAuditEvents().filter(event => event.eventType === 'ENTITY_DELETED').length, 0);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('Entity default numbering remains monotonic across Retire and Delete', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-entity-counter-delete-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const entities = new EntityService(repo, new AuditService(repo));
  try {
    const first = entities.quickCreate('corr_create_1');
    assert.equal(first.name, 'New Entity 1');
    entities.retire(first.id, 'corr_retire');
    entities.deleteRetired(first.id, 'corr_delete');
    const second = entities.quickCreate('corr_create_2');
    assert.equal(second.name, 'New Entity 2');
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});
