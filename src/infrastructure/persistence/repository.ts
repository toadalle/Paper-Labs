import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  Arena,
  AuditEvent,
  Entity,
  EntityTombstone,
  EvaluationSuite,
  EvolutionPolicy,
  EvolutionRun,
  EvaluationRun,
  ExecutionPolicy,
  RewardPolicy,
  Experience,
  ExperienceEvent,
  ExperienceTrace,
  MarketDataSnapshot,
  MarketMemoryCell,
  NotificationEvent,
  PromotionDecision,
  ResearchValidity
} from '../../domain/types.js';
import { canonicalJson, sha256 } from '../hash.js';

type Kind =
  | 'entity'
  | 'entity_tombstone'
  | 'market_data_snapshot'
  | 'arena'
  | 'evaluation_suite'
  | 'experience'
  | 'experience_event'
  | 'experience_trace'
  | 'evaluation_run'
  | 'execution_policy'
  | 'reward_policy'
  | 'market_memory_cell'
  | 'evolution_policy'
  | 'evolution_run'
  | 'promotion_decision';

interface JsonRow { body: string }

export class Repository {
  private readonly db: DatabaseSync;
  private transactionDepth = 0;

  constructor(path = 'data/paper-labs.sqlite') {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS objects(
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        body TEXT NOT NULL,
        immutable INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(kind,id)
      );
      CREATE INDEX IF NOT EXISTS idx_objects_kind_updated ON objects(kind, updated_at DESC);

      CREATE TABLE IF NOT EXISTS counters(
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_events(
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        severity TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notification_events_created ON notification_events(created_at DESC);

      CREATE TABLE IF NOT EXISTS audit_events(
        sequence INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        body TEXT NOT NULL,
        event_hash TEXT NOT NULL,
        previous_event_hash TEXT,
        occurred_at TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  withTransaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) return fn();
    this.db.exec('BEGIN IMMEDIATE;');
    this.transactionDepth += 1;
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  reserveCounter(name: string, minimumExisting = 0): number {
    return this.withTransaction(() => {
      const current = this.db.prepare('SELECT value FROM counters WHERE name=?').get(name) as { value: number } | undefined;
      const next = Math.max(current?.value ?? 0, minimumExisting) + 1;
      this.db.prepare(`
        INSERT INTO counters(name,value) VALUES(?,?)
        ON CONFLICT(name) DO UPDATE SET value=excluded.value
      `).run(name, next);
      return next;
    });
  }

  private save<T extends { id: string }>(kind: Kind, value: T, immutable = false): T {
    const existing = this.db.prepare('SELECT immutable FROM objects WHERE kind=? AND id=?').get(kind, value.id) as { immutable: number } | undefined;
    if (existing?.immutable) throw new Error(`${kind}:${value.id} is immutable and cannot be overwritten.`);
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO objects(kind,id,body,immutable,created_at,updated_at)
      VALUES(?,?,?,?,?,?)
      ON CONFLICT(kind,id) DO UPDATE SET
        body=excluded.body,
        immutable=CASE WHEN objects.immutable=1 THEN 1 ELSE excluded.immutable END,
        updated_at=excluded.updated_at
    `).run(kind, value.id, JSON.stringify(value), immutable ? 1 : 0, now, now);
    return structuredClone(value);
  }

  private get<T>(kind: Kind, id: string): T | null {
    const row = this.db.prepare('SELECT body FROM objects WHERE kind=? AND id=?').get(kind, id) as JsonRow | undefined;
    return row ? JSON.parse(row.body) as T : null;
  }

  private list<T>(kind: Kind): T[] {
    const rows = this.db.prepare('SELECT body FROM objects WHERE kind=? ORDER BY updated_at DESC').all(kind) as unknown as JsonRow[];
    return rows.map(row => JSON.parse(row.body) as T);
  }

  private lock(kind: Kind, id: string): void {
    const result = this.db.prepare('UPDATE objects SET immutable=1, updated_at=? WHERE kind=? AND id=?').run(new Date().toISOString(), kind, id);
    if (Number(result.changes) === 0) throw new Error(`${kind}:${id} not found.`);
  }

  isLocked(kind: Kind, id: string): boolean {
    const row = this.db.prepare('SELECT immutable FROM objects WHERE kind=? AND id=?').get(kind, id) as { immutable: number } | undefined;
    return Boolean(row?.immutable);
  }

  saveEntity(value: Entity): Entity {
    const existing = this.get<Entity>('entity', value.id);
    if (existing) {
      const immutableOriginChanged =
        existing.createdAt !== value.createdAt ||
        existing.birthEvolutionRunId !== value.birthEvolutionRunId ||
        existing.parentEntityId !== value.parentEntityId ||
        existing.mutationOperator !== value.mutationOperator;
      if (immutableOriginChanged) throw new Error('Entity lineage/origin fields are immutable after birth.');

      if (existing.configurationStatus === 'READY') {
        const birthConfigurationChanged =
          value.configurationStatus !== 'READY' ||
          existing.strategyType !== value.strategyType ||
          existing.strategyVersion !== value.strategyVersion ||
          existing.traitHash !== value.traitHash ||
          canonicalJson(existing.traits) !== canonicalJson(value.traits);
        if (birthConfigurationChanged) throw new Error('READY Entity strategy and traits are birth-immutable.');
      }
    }
    return this.save('entity', value);
  }
  getEntity(id: string): Entity | null { return this.get('entity', id); }
  listEntities(): Entity[] { return this.list('entity'); }
  deleteEntity(id: string): void {
    const result = this.db.prepare('DELETE FROM objects WHERE kind=? AND id=?').run('entity', id);
    if (Number(result.changes) === 0) throw new Error('Entity not found.');
  }
  saveEntityTombstone(value: EntityTombstone): EntityTombstone { return this.save('entity_tombstone', value, true); }
  getEntityTombstone(id: string): EntityTombstone | null { return this.get('entity_tombstone', id); }
  listEntityTombstones(): EntityTombstone[] { return this.list('entity_tombstone'); }
  getEntityHistoricalIdentity(id: string): Entity | EntityTombstone | null { return this.getEntity(id) ?? this.getEntityTombstone(id); }

  saveMarketDataSnapshot(value: MarketDataSnapshot): MarketDataSnapshot { return this.save('market_data_snapshot', value, true); }
  getMarketDataSnapshot(id: string): MarketDataSnapshot | null { return this.get('market_data_snapshot', id); }
  transitionMarketDataSnapshotStatus(id: string, status: MarketDataSnapshot['status']): MarketDataSnapshot {
    const current = this.getMarketDataSnapshot(id);
    if (!current) throw new Error('MarketDataSnapshot not found.');
    if (current.status === status) return current;
    if (current.status === 'COMPROMISED') throw new Error('Compromised MarketDataSnapshot status is terminal.');
    if (current.status === 'SUPERSEDED' && status !== 'COMPROMISED') throw new Error('Superseded MarketDataSnapshot may only transition to COMPROMISED.');
    const next = { ...current, status };
    this.db.prepare('UPDATE objects SET body=?, updated_at=? WHERE kind=? AND id=?').run(JSON.stringify(next), new Date().toISOString(), 'market_data_snapshot', id);
    return structuredClone(next);
  }
  listMarketDataSnapshots(): MarketDataSnapshot[] { return this.list('market_data_snapshot'); }

  saveArena(value: Arena): Arena { return this.save('arena', value); }
  getArena(id: string): Arena | null { return this.get('arena', id); }
  listArenas(): Arena[] { return this.list('arena'); }
  lockArena(id: string): void { this.lock('arena', id); }

  saveEvaluationSuite(value: EvaluationSuite): EvaluationSuite { return this.save('evaluation_suite', value); }
  getEvaluationSuite(id: string): EvaluationSuite | null { return this.get('evaluation_suite', id); }
  listEvaluationSuites(): EvaluationSuite[] { return this.list('evaluation_suite'); }
  lockEvaluationSuite(id: string): void { this.lock('evaluation_suite', id); }

  saveExperience(value: Experience): Experience {
    return this.withTransaction(() => {
      const saved = this.save('experience', value, value.status !== 'RUNNING');
      if (value.status === 'COMPLETED') {
        if (this.getArena(value.arenaVersionId)) this.lockArena(value.arenaVersionId);
        if (value.evolutionPolicyVersionId && this.getEvolutionPolicy(value.evolutionPolicyVersionId)) {
          this.lockEvolutionPolicy(value.evolutionPolicyVersionId);
        }
        if (value.evaluationSuiteVersionId && this.getEvaluationSuite(value.evaluationSuiteVersionId)) {
          this.lockEvaluationSuite(value.evaluationSuiteVersionId);
        }
      }
      return saved;
    });
  }
  getExperience(id: string): Experience | null { return this.get('experience', id); }
  listExperiences(): Experience[] { return this.list('experience'); }
  listExperiencesBySnapshot(snapshotId: string): Experience[] {
    return this.listExperiences().filter(experience => experience.marketDataSnapshotIds.includes(snapshotId));
  }
  listResearchValidExperiences(): Experience[] {
    return this.listExperiences().filter(experience => experience.researchValidity === 'VALID');
  }
  transitionExperienceResearchValidity(id: string, status: ResearchValidity): Experience {
    const current = this.getExperience(id);
    if (!current) throw new Error('Experience not found.');
    if (current.researchValidity === status) return current;
    if (current.researchValidity === 'COMPROMISED_SOURCE') {
      throw new Error('Compromised Experience researchValidity is terminal.');
    }
    if (status !== 'COMPROMISED_SOURCE') throw new Error('Unsupported Experience researchValidity transition.');
    const next = { ...current, researchValidity: status };
    this.db.prepare('UPDATE objects SET body=?, updated_at=? WHERE kind=? AND id=?').run(JSON.stringify(next), new Date().toISOString(), 'experience', id);
    return structuredClone(next);
  }

  saveExperienceEvent(value: ExperienceEvent): ExperienceEvent { return this.save('experience_event', value, true); }
  listExperienceEvents(): ExperienceEvent[] { return this.list('experience_event'); }

  listExperienceEventsByExperience(experienceId: string): ExperienceEvent[] {
    return this.listExperienceEvents().filter(event => event.experienceId === experienceId).sort((a, b) => a.sequence - b.sequence);
  }

  saveExperienceTrace(value: ExperienceTrace): ExperienceTrace { return this.save('experience_trace', value, true); }
  getExperienceTrace(id: string): ExperienceTrace | null { return this.get('experience_trace', id); }
  listExperienceTraces(): ExperienceTrace[] { return this.list('experience_trace'); }

  saveEvaluationRun(value: EvaluationRun): EvaluationRun { return this.save('evaluation_run', value); }
  getEvaluationRun(id: string): EvaluationRun | null { return this.get('evaluation_run', id); }
  listEvaluationRuns(): EvaluationRun[] { return this.list('evaluation_run'); }

  saveExecutionPolicy(value: ExecutionPolicy): ExecutionPolicy { return this.save('execution_policy', value, true); }
  getExecutionPolicy(id: string): ExecutionPolicy | null { return this.get('execution_policy', id); }
  listExecutionPolicies(): ExecutionPolicy[] { return this.list('execution_policy'); }

  saveRewardPolicy(value: RewardPolicy): RewardPolicy { return this.save('reward_policy', value, true); }
  getRewardPolicy(id: string): RewardPolicy | null { return this.get('reward_policy', id); }
  listRewardPolicies(): RewardPolicy[] { return this.list('reward_policy'); }

  saveMarketMemoryCell(value: MarketMemoryCell): MarketMemoryCell { return this.save('market_memory_cell', value); }
  listMarketMemoryCells(): MarketMemoryCell[] { return this.list('market_memory_cell'); }

  saveEvolutionPolicy(value: EvolutionPolicy): EvolutionPolicy { return this.save('evolution_policy', value); }
  getEvolutionPolicy(id: string): EvolutionPolicy | null { return this.get('evolution_policy', id); }
  listEvolutionPolicies(): EvolutionPolicy[] { return this.list('evolution_policy'); }
  lockEvolutionPolicy(id: string): void { this.lock('evolution_policy', id); }

  saveEvolutionRun(value: EvolutionRun): EvolutionRun { return this.save('evolution_run', value); }
  getEvolutionRun(id: string): EvolutionRun | null { return this.get('evolution_run', id); }
  listEvolutionRuns(): EvolutionRun[] { return this.list('evolution_run'); }

  savePromotionDecision(value: PromotionDecision): PromotionDecision { return this.save('promotion_decision', value, true); }
  listPromotionDecisions(): PromotionDecision[] { return this.list('promotion_decision'); }

  appendNotification(value: NotificationEvent): NotificationEvent {
    const existing = this.db.prepare('SELECT 1 AS found FROM notification_events WHERE id=?').get(value.id) as { found: number } | undefined;
    if (existing) throw new Error('NotificationEvent id already exists.');
    this.db.prepare('INSERT INTO notification_events(id,created_at,severity,body) VALUES(?,?,?,?)')
      .run(value.id, value.createdAt, value.severity, JSON.stringify(value));
    return structuredClone(value);
  }

  listNotifications(limit = 250, offset = 0): NotificationEvent[] {
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
    const safeOffset = Math.max(0, Math.floor(offset));
    const rows = this.db.prepare('SELECT body FROM notification_events ORDER BY created_at DESC LIMIT ? OFFSET ?').all(safeLimit, safeOffset) as unknown as JsonRow[];
    return rows.map(row => JSON.parse(row.body) as NotificationEvent);
  }

  getNotification(id: string): NotificationEvent | null {
    const row = this.db.prepare('SELECT body FROM notification_events WHERE id=?').get(id) as JsonRow | undefined;
    return row ? JSON.parse(row.body) as NotificationEvent : null;
  }

  updateNotificationPresentation(id: string, patch: { seen?: boolean; dismissed?: boolean }): NotificationEvent {
    const current = this.getNotification(id);
    if (!current) throw new Error('Notification not found.');
    const next: NotificationEvent = {
      ...current,
      seen: patch.seen ?? current.seen,
      dismissed: patch.dismissed ?? current.dismissed
    };
    this.db.prepare('UPDATE notification_events SET body=? WHERE id=?').run(JSON.stringify(next), id);
    return structuredClone(next);
  }

  markAllNotificationsSeen(): number {
    const raw = this.db.prepare('SELECT body FROM notification_events ORDER BY created_at DESC').all() as unknown as JsonRow[];
    const rows = raw.map(row => JSON.parse(row.body) as NotificationEvent);
    let changed = 0;
    this.withTransaction(() => {
      for (const current of rows) {
        if (current.seen) continue;
        const next = { ...current, seen: true };
        this.db.prepare('UPDATE notification_events SET body=? WHERE id=?').run(JSON.stringify(next), current.id);
        changed += 1;
      }
    });
    return changed;
  }

  countNotifications(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM notification_events').get() as { count: number };
    return Number(row.count);
  }

  appendAuditEvent(value: AuditEvent): AuditEvent {
    const existing = this.db.prepare('SELECT 1 AS found FROM audit_events WHERE id=? OR sequence=?').get(value.id, value.sequence) as { found: number } | undefined;
    if (existing) throw new Error('AuditEvent is append-only and the id/sequence already exists.');
    this.db.prepare(`
      INSERT INTO audit_events(sequence,id,body,event_hash,previous_event_hash,occurred_at)
      VALUES(?,?,?,?,?,?)
    `).run(value.sequence, value.id, JSON.stringify(value), value.eventHash, value.previousEventHash, value.occurredAt);
    return structuredClone(value);
  }

  lastAuditEvent(): AuditEvent | null {
    const row = this.db.prepare('SELECT body FROM audit_events ORDER BY sequence DESC LIMIT 1').get() as JsonRow | undefined;
    return row ? JSON.parse(row.body) as AuditEvent : null;
  }

  listAuditEvents(): AuditEvent[] {
    const rows = this.db.prepare('SELECT body FROM audit_events ORDER BY sequence ASC').all() as unknown as JsonRow[];
    return rows.map(row => JSON.parse(row.body) as AuditEvent);
  }

  count(kind: Kind): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM objects WHERE kind=?').get(kind) as { count: number };
    return Number(row.count);
  }

  objectHash(kind: Kind, id: string): string | null {
    const value = this.get<Record<string, unknown>>(kind, id);
    return value ? sha256(canonicalJson(value)) : null;
  }

  // Test/support hook used only to prove audit tamper detection. No application route exposes this.
  unsafeReplaceAuditBodyForTest(sequence: number, body: string): void {
    this.db.prepare('UPDATE audit_events SET body=? WHERE sequence=?').run(body, sequence);
  }
}
