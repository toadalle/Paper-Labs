import type { Arena, AuditEvent, Entity, EvaluationRun, EvolutionRun, Experience, ExperienceEvent, ExperienceTrace, MarketAsset, MarketAssetClass, MarketBar, MarketQuote, NotificationEvent } from '../domain/types.js';

export interface AuditIntegrityView {
  valid: boolean;
  eventCount: number;
  firstBrokenSequence: number | null;
  reason: string | null;
  checkedAt: string;
}

export interface ProviderView {
  checkedAt: string | null;
  configured: boolean;
  historical: Record<string, string>;
  live: Record<string, string>;
  assetClasses: MarketAssetClass[];
  notes: string[];
}

export interface EntityMetricsView {
  recentReward: number | null;
  consistency: number | null;
  age: number;
  lastActivity: string;
}

export interface BootstrapView {
  product: { name: string; version: string };
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
  provider: ProviderView;
  auditIntegrity: AuditIntegrityView;
}

export interface LiveQuoteView {
  quote: MarketQuote;
  capability: string;
}

export interface AssetSearchView {
  assets: MarketAsset[];
}

export interface LiveChartView {
  symbol: string;
  assetClass: MarketAssetClass;
  provider: string;
  feed: string;
  range: '1D' | '5D' | '1M' | '3M' | 'YTD' | '1Y' | 'MAX';
  timeframe: string;
  requestedStart: string;
  requestedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  bars: MarketBar[];
}


export interface NotificationListView {
  notifications: NotificationEvent[];
  total: number;
}

export interface ConsoleLogRecord {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  category: string;
  event: string;
  message: string;
  correlationId: string | null;
  requestId: string | null;
  entityId: string | null;
  arenaId: string | null;
  experienceId: string | null;
  evolutionRunId: string | null;
  snapshotId: string | null;
  durationMs: number | null;
  error: { name: string; message: string; stack: string | null; code: string | null } | null;
  context: Record<string, unknown>;
}

export interface ConsoleLogsView { logs: ConsoleLogRecord[]; }
export interface ConsoleAuditView { events: AuditEvent[]; }
export interface ConsoleOverviewView {
  version: string;
  uptimeSeconds: number;
  node: string;
  platform: string;
  arch: string;
  provider: ProviderView;
  auditIntegrity: AuditIntegrityView;
  counts: { notifications: number; auditEvents: number; snapshots: number; experiences: number };
}

export interface ExperienceDetailView { experience: Experience; events: ExperienceEvent[]; trace: ExperienceTrace | null; }

export type PortableImportSurface = 'ENTITY_OBJECTS' | 'ENTITY_SELECTED' | 'ARENA_OBJECTS' | 'ARENA_SELECTED';
export interface PortableImportChangeView { path: string; oldValue: unknown; newValue: unknown; classification: 'MUTABLE' | 'IMMUTABLE' | 'CREATE' | 'INHERITED' | 'ENVIRONMENT'; }
export interface PortableImportOperationView {
  id: string;
  objectKind: 'entity' | 'arena';
  action: 'CREATE' | 'PATCH' | 'CREATE_VERSION' | 'CREATE_VARIANT' | 'NO_OP' | 'BLOCKED';
  targetId: string | null;
  sourceAlias: string | null;
  summary: string;
  changes: PortableImportChangeView[];
  consequences: string[];
}
export interface PortableImportPlanView {
  id: string;
  planHash: string;
  format: 'paper-lab';
  version: 1;
  kind: 'entity' | 'arena' | 'bundle';
  context: { surface: PortableImportSurface; targetId?: string | null };
  valid: boolean;
  operations: PortableImportOperationView[];
  warnings: string[];
  errors: string[];
  createdAt: string;
  expiresAt: string;
}
export interface PortableImportResultView {
  planId: string;
  correlationId: string;
  operations: PortableImportOperationView[];
  createdIds: string[];
  updatedIds: string[];
  createdVersions: string[];
  aliasMap: Record<string, string>;
  warnings: string[];
}
