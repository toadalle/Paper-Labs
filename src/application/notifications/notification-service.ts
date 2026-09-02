import { createId } from '../../domain/id.js';
import type { NotificationEvent, NotificationSeverity } from '../../domain/types.js';
import type { Repository } from '../../infrastructure/persistence/repository.js';

export interface NotificationInput {
  severity: NotificationSeverity;
  category?: string;
  title: string;
  message: string;
  correlationId?: string | null;
  auditEventId?: string | null;
  target?: NotificationEvent['target'];
}

export class NotificationService {
  constructor(private readonly repository: Repository) {}

  create(input: NotificationInput): NotificationEvent {
    const event: NotificationEvent = {
      id: createId('notification'),
      createdAt: new Date().toISOString(),
      severity: input.severity,
      category: input.category?.trim() || 'general',
      title: input.title.trim(),
      message: input.message.trim(),
      seen: false,
      dismissed: false,
      correlationId: input.correlationId ?? null,
      auditEventId: input.auditEventId ?? null,
      target: input.target ?? null
    };
    if (!event.title || !event.message) throw new Error('Notification title and message are required.');
    return this.repository.appendNotification(event);
  }

  markSeen(id: string): NotificationEvent { return this.repository.updateNotificationPresentation(id, { seen: true }); }
  markDismissed(id: string): NotificationEvent { return this.repository.updateNotificationPresentation(id, { seen: true, dismissed: true }); }
  markAllSeen(): number { return this.repository.markAllNotificationsSeen(); }
}
