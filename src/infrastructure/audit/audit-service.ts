import { createId } from '../../domain/id.js';
import { DOMAIN_SCHEMA_VERSION } from '../../domain/version.js';
import type { AuditActorType, AuditEvent } from '../../domain/types.js';
import { canonicalJson, sha256 } from '../hash.js';
import type { Repository } from '../persistence/repository.js';


const sensitiveKey = /(api[-_]?key|secret|authorization|token|cookie|password|credential)/i;

function safeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[max-depth]';
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => safeAuditValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sensitiveKey.test(key) ? '[redacted]' : safeAuditValue(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}

export interface AuditInput {
  eventType: string;
  actor?: { type: AuditActorType; id: string | null };
  subject: { type: string; id: string; version?: number | null };
  correlationId: string;
  causationId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
  beforeHash?: string | null;
  afterHash?: string | null;
}

export interface AuditIntegrityResult {
  valid: boolean;
  eventCount: number;
  firstBrokenSequence: number | null;
  reason: string | null;
  checkedAt: string;
}

export class AuditService {
  constructor(
    private readonly repository: Repository,
    private readonly beforeAppend: (() => void) | null = null
  ) {}

  record(input: AuditInput): AuditEvent {
    return this.repository.withTransaction(() => {
      const previous = this.repository.lastAuditEvent();
      const sequence = (previous?.sequence ?? 0) + 1;
      const base = {
        id: createId('audit'),
        sequence,
        occurredAt: new Date().toISOString(),
        eventType: input.eventType,
        actor: input.actor ?? { type: 'SYSTEM' as const, id: null },
        subject: {
          type: input.subject.type,
          id: input.subject.id,
          version: input.subject.version ?? null
        },
        correlationId: input.correlationId,
        causationId: input.causationId ?? null,
        summary: input.summary,
        details: safeAuditValue(input.details ?? {}) as Record<string, unknown>,
        beforeHash: input.beforeHash ?? null,
        afterHash: input.afterHash ?? null,
        previousEventHash: previous?.eventHash ?? null,
        schemaVersion: DOMAIN_SCHEMA_VERSION
      };
      const eventHash = sha256(canonicalJson(base));
      const event: AuditEvent = { ...base, eventHash };
      this.beforeAppend?.();
      this.repository.appendAuditEvent(event);
      return structuredClone(event);
    });
  }

  verify(): AuditIntegrityResult {
    const events = this.repository.listAuditEvents();
    let previousHash: string | null = null;
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]!;
      const expectedSequence = index + 1;
      if (event.sequence !== expectedSequence) {
        return this.failure(events.length, event.sequence, `Expected sequence ${expectedSequence}.`);
      }
      if (event.previousEventHash !== previousHash) {
        return this.failure(events.length, event.sequence, 'Previous-event hash linkage is broken.');
      }
      const { eventHash: _eventHash, ...base } = event;
      if (sha256(canonicalJson(base)) !== event.eventHash) {
        return this.failure(events.length, event.sequence, 'Event hash does not match canonical event content.');
      }
      previousHash = event.eventHash;
    }
    return {
      valid: true,
      eventCount: events.length,
      firstBrokenSequence: null,
      reason: null,
      checkedAt: new Date().toISOString()
    };
  }

  private failure(eventCount: number, sequence: number, reason: string): AuditIntegrityResult {
    return {
      valid: false,
      eventCount,
      firstBrokenSequence: sequence,
      reason,
      checkedAt: new Date().toISOString()
    };
  }
}
