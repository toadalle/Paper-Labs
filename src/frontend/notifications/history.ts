import type { NotificationEvent } from '../../domain/types.js';

export type NotificationHistoryGranularity = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface NotificationHistoryGroup {
  key: string;
  label: string;
  granularity: NotificationHistoryGranularity;
  defaultOpen: boolean;
  notifications: NotificationEvent[];
}

const DAY_MS = 86_400_000;

function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isoWeekKey(date: Date): string {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const isoYear = value.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function groupDescriptor(date: Date, now: Date): Omit<NotificationHistoryGroup, 'notifications'> {
  const ageDays = Math.max(0, Math.floor((utcDayStart(now) - utcDayStart(date)) / DAY_MS));

  if (ageDays < 14) {
    const key = date.toISOString().slice(0, 10);
    return { key: `day:${key}`, label: key, granularity: 'DAY', defaultOpen: true };
  }

  if (ageDays < 90) {
    const key = isoWeekKey(date);
    return { key: `week:${key}`, label: key, granularity: 'WEEK', defaultOpen: false };
  }

  if (ageDays < 365) {
    const key = date.toISOString().slice(0, 7);
    return { key: `month:${key}`, label: key, granularity: 'MONTH', defaultOpen: false };
  }

  const key = date.toISOString().slice(0, 4);
  return { key: `year:${key}`, label: key, granularity: 'YEAR', defaultOpen: false };
}

/**
 * Groups an already time-ordered notification history into progressively
 * coarser ISO buckets: recent days, then ISO weeks, months, and years.
 */
export function groupNotificationHistory(notifications: NotificationEvent[], now = new Date()): NotificationHistoryGroup[] {
  const groups: NotificationHistoryGroup[] = [];
  const byKey = new Map<string, NotificationHistoryGroup>();

  for (const notification of notifications) {
    const created = new Date(notification.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const descriptor = groupDescriptor(created, now);
    let group = byKey.get(descriptor.key);
    if (!group) {
      group = { ...descriptor, notifications: [] };
      byKey.set(descriptor.key, group);
      groups.push(group);
    }
    group.notifications.push(notification);
  }

  return groups;
}
