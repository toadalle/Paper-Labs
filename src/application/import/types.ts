import type { EntityTraits } from '../../domain/types.js';

export const PLPS_FORMAT = 'paper-lab';
export const PLPS_VERSION = 1;

export type PortableKind = 'entity' | 'arena' | 'bundle';
export type ImportSurface = 'ENTITY_OBJECTS' | 'ENTITY_SELECTED' | 'ARENA_OBJECTS' | 'ARENA_SELECTED';
export type ImportAction = 'CREATE' | 'PATCH' | 'CREATE_VERSION' | 'CREATE_VARIANT' | 'NO_OP' | 'BLOCKED';

export interface PortableEntityStrategySpec {
  type?: string;
  version?: number;
  traits?: EntityTraits;
}

export interface PortableEntitySpec {
  name?: string;
  family?: string | null;
  strategy?: PortableEntityStrategySpec;
}

export interface PortableArenaExecutionPolicySpec {
  commissionPerTrade?: number;
  slippageBps?: number;
}

export interface PortableArenaRewardPolicySpec {
  lambda?: number;
  maxDrawdownGate?: number;
  minimumTradeCount?: number;
}

export interface PortableArenaSpec {
  name?: string;
  symbol?: string;
  timeframe?: string;
  start?: string;
  end?: string;
  initialCapital?: number;
  warmupBars?: number;
  executionPolicy?: PortableArenaExecutionPolicySpec;
  rewardPolicy?: PortableArenaRewardPolicySpec;
}

export interface PortableBundleObject {
  alias: string;
  kind: 'entity' | 'arena';
  spec: PortableEntitySpec | PortableArenaSpec;
}

export interface PortableBundleSpec {
  objects: PortableBundleObject[];
}

export type PortableDocument =
  | { format: typeof PLPS_FORMAT; version: typeof PLPS_VERSION; kind: 'entity'; spec: PortableEntitySpec }
  | { format: typeof PLPS_FORMAT; version: typeof PLPS_VERSION; kind: 'arena'; spec: PortableArenaSpec }
  | { format: typeof PLPS_FORMAT; version: typeof PLPS_VERSION; kind: 'bundle'; spec: PortableBundleSpec };

export interface ImportContext {
  surface: ImportSurface;
  targetId?: string | null;
}

export interface ImportChange {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  classification: 'MUTABLE' | 'IMMUTABLE' | 'CREATE' | 'INHERITED' | 'ENVIRONMENT';
}

export interface ImportOperationView {
  id: string;
  objectKind: 'entity' | 'arena';
  action: ImportAction;
  targetId: string | null;
  sourceAlias: string | null;
  summary: string;
  changes: ImportChange[];
  consequences: string[];
}

export interface ImportPlanView {
  id: string;
  planHash: string;
  format: typeof PLPS_FORMAT;
  version: typeof PLPS_VERSION;
  kind: PortableKind;
  context: ImportContext;
  valid: boolean;
  operations: ImportOperationView[];
  warnings: string[];
  errors: string[];
  createdAt: string;
  expiresAt: string;
}

export interface ImportResult {
  planId: string;
  correlationId: string;
  operations: ImportOperationView[];
  createdIds: string[];
  updatedIds: string[];
  createdVersions: string[];
  aliasMap: Record<string, string>;
  warnings: string[];
}
