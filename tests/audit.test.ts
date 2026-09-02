import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AuditService } from '../src/infrastructure/audit/audit-service.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';

test('AuditEvents are append-only, monotonic, and form a verifiable hash chain', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-audit-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  try {
    const first = audit.record({ eventType: 'TEST_ONE', subject: { type: 'Test', id: 'one' }, correlationId: 'corr_1', summary: 'one' });
    const second = audit.record({ eventType: 'TEST_TWO', subject: { type: 'Test', id: 'two' }, correlationId: 'corr_1', summary: 'two' });
    assert.equal(first.sequence, 1);
    assert.equal(second.sequence, 2);
    assert.equal(second.previousEventHash, first.eventHash);
    assert.equal(audit.verify().valid, true);
    assert.throws(() => repo.appendAuditEvent(first), /append-only/);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('audit verifier detects modified historical record bodies', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-audit-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  try {
    audit.record({ eventType: 'TEST', subject: { type: 'Test', id: 'one' }, correlationId: 'corr_1', summary: 'original' });
    const event = repo.listAuditEvents()[0]!;
    repo.unsafeReplaceAuditBodyForTest(1, JSON.stringify({ ...event, summary: 'tampered' }));
    const result = audit.verify();
    assert.equal(result.valid, false);
    assert.equal(result.firstBrokenSequence, 1);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('audit-required mutation rolls back when AuditEvent append fails', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-audit-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo, () => { throw new Error('simulated audit sink failure'); });
  try {
    const { EntityService } = await import('../src/application/services/entity-service.js');
    const entities = new EntityService(repo, audit);
    assert.throws(() => entities.quickCreate('corr_fail'), /simulated audit sink failure/);
    assert.equal(repo.listEntities().length, 0);
    assert.equal(repo.listAuditEvents().length, 0);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('AuditEvent details exclude secret-bearing fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-audit-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  try {
    audit.record({ eventType: 'SAFE', subject: { type: 'Test', id: 'one' }, correlationId: 'corr', summary: 'safe', details: { symbol: 'SPY', apiKey: 'never-store-me' } });
    const event = repo.listAuditEvents()[0]!;
    assert.equal(event.details.symbol, 'SPY');
    assert.equal(event.details.apiKey, '[redacted]');
    assert.doesNotMatch(JSON.stringify(event), /never-store-me/);
  } finally { repo.close(); rmSync(dir, { recursive: true, force: true }); }
});
