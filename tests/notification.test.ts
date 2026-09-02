import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { NotificationService } from '../src/application/notifications/notification-service.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';

test('NotificationEvents persist separately from AuditEvents and retain history after dismissal', () => {
  const root = mkdtempSync(join(tmpdir(), 'paper-labs-notify-'));
  const repository = new Repository(join(root, 'test.sqlite'));
  const notifications = new NotificationService(repository);
  try {
    const created = notifications.create({ severity: 'SUCCESS', title: 'Created', message: 'New Entity 1 created.', correlationId: 'corr_1' });
    assert.equal(repository.listAuditEvents().length, 0);
    assert.equal(repository.listNotifications().length, 1);
    notifications.markDismissed(created.id);
    const history = repository.listNotifications();
    assert.equal(history.length, 1);
    assert.equal(history[0]!.dismissed, true);
    assert.equal(history[0]!.seen, true);
  } finally {
    repository.close();
  }
});

test('markAllNotificationsSeen updates presentation state without deleting history', () => {
  const root = mkdtempSync(join(tmpdir(), 'paper-labs-notify-'));
  const repository = new Repository(join(root, 'test.sqlite'));
  const notifications = new NotificationService(repository);
  try {
    notifications.create({ severity: 'INFO', title: 'One', message: 'First.' });
    notifications.create({ severity: 'WARNING', title: 'Two', message: 'Second.' });
    assert.equal(notifications.markAllSeen(), 2);
    assert.equal(repository.listNotifications().every(item => item.seen), true);
    assert.equal(repository.countNotifications(), 2);
  } finally {
    repository.close();
  }
});
