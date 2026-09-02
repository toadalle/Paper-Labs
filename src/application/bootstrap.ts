import type { Repository } from '../infrastructure/persistence/repository.js';
import type { MarketDataCapabilities } from '../infrastructure/market-data/provider.js';
import type { Arena, Entity, EvaluationRun, EvolutionRun, Experience } from '../domain/types.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../domain/version.js';
import type { AuditIntegrityResult } from '../infrastructure/audit/audit-service.js';

export interface EntityMetricsView {
  recentReward: number | null;
  consistency: number | null;
  age: number;
  lastActivity: string;
}

export interface BootstrapView {
  product: {
    name: string;
    version: string;
  };
  counts: {
    entities: number;
    arenas: number;
    experiences: number;
    snapshots: number;
    evolutionRuns: number;
    auditEvents: number;
  };
  entities: Entity[];
  entityMetrics: Record<string, EntityMetricsView>;
  arenas: Arena[];
  evolutionRuns: EvolutionRun[];
  evaluationRuns: EvaluationRun[];
  experiences: Experience[];
  provider: MarketDataCapabilities;
  auditIntegrity: AuditIntegrityResult;
}

export function buildBootstrap(
  repository: Repository,
  provider: MarketDataCapabilities,
  auditIntegrity: AuditIntegrityResult
): BootstrapView {
  const entities = repository.listEntities();
  const experiences = repository.listExperiences();
  return {
    product: {
      name: PRODUCT_NAME,
      version: PRODUCT_VERSION
    },
    counts: {
      entities: entities.length,
      arenas: repository.count('arena'),
      experiences: experiences.length,
      snapshots: repository.count('market_data_snapshot'),
      evolutionRuns: repository.count('evolution_run'),
      auditEvents: repository.listAuditEvents().length
    },
    entities,
    entityMetrics: Object.fromEntries(entities.map(entity => [entity.id, metricsFor(entity, experiences)])),
    arenas: repository.listArenas(),
    evolutionRuns: repository.listEvolutionRuns(),
    evaluationRuns: repository.listEvaluationRuns(),
    experiences,
    provider,
    auditIntegrity
  };
}

function metricsFor(entity: Entity, experiences: Experience[]): EntityMetricsView {
  const completed = experiences
    .filter(experience => experience.entityId === entity.id && experience.status === 'COMPLETED' && experience.researchValidity === 'VALID')
    .sort((a, b) => String(a.completedAt ?? '').localeCompare(String(b.completedAt ?? '')));
  const rewarded = completed.filter(experience => typeof experience.reward === 'number');
  const positive = rewarded.filter(experience => (experience.reward ?? 0) > 0).length;
  const last = completed.at(-1);
  return {
    recentReward: typeof last?.reward === 'number' ? last.reward : null,
    consistency: rewarded.length ? positive / rewarded.length : null,
    age: completed.length,
    lastActivity: latestTimestamp(entity.createdAt, ...completed.flatMap(experience => [experience.startedAt, experience.completedAt].filter((value): value is string => Boolean(value))))
  };
}

function latestTimestamp(...values: string[]): string {
  return values.reduce((latest, value) => value > latest ? value : latest, values[0] ?? new Date(0).toISOString());
}
