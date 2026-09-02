import test from 'node:test';
import assert from 'node:assert/strict';
import type { NotificationEvent } from '../src/domain/types.js';
import { groupNotificationHistory } from '../src/frontend/notifications/history.js';

function notification(id: string, createdAt: string): NotificationEvent {
  return {
    id,
    createdAt,
    severity: 'INFO',
    category: 'test',
    title: id,
    message: id,
    seen: true,
    dismissed: true,
    correlationId: null,
    auditEventId: null,
    target: null
  };
}

test('notification history progressively groups recent days, ISO weeks, months, and years', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');
  const groups = groupNotificationHistory([
    notification('today-a', '2026-09-01T11:00:00.000Z'),
    notification('today-b', '2026-09-01T10:00:00.000Z'),
    notification('recent-day', '2026-08-25T12:00:00.000Z'),
    notification('week-a', '2026-08-10T12:00:00.000Z'),
    notification('week-b', '2026-08-09T12:00:00.000Z'),
    notification('month', '2026-04-15T12:00:00.000Z'),
    notification('year', '2024-12-31T12:00:00.000Z')
  ], now);

  assert.equal(groups[0]?.key, 'day:2026-09-01');
  assert.equal(groups[0]?.notifications.length, 2);
  assert.equal(groups[0]?.defaultOpen, true);
  assert.equal(groups[1]?.key, 'day:2026-08-25');
  assert.equal(groups[2]?.granularity, 'WEEK');
  assert.equal(groups[2]?.defaultOpen, false);
  assert.equal(groups.some(group => group.granularity === 'MONTH'), true);
  assert.equal(groups.at(-1)?.key, 'year:2024');
});

test('notification history preserves encounter order within each chronological group', () => {
  const rows = [
    notification('newer', '2026-09-01T11:00:00.000Z'),
    notification('older', '2026-09-01T09:00:00.000Z')
  ];
  const groups = groupNotificationHistory(rows, new Date('2026-09-01T12:00:00.000Z'));
  assert.deepEqual(groups[0]?.notifications.map(item => item.id), ['newer', 'older']);
});
