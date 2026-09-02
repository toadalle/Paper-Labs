export type IsoTimestamp = string;

export type LifecycleState = 'CANDIDATE' | 'PERMANENT' | 'RETIRED';
export type CandidateStatus = 'ACTIVE' | 'DEAD' | null;
export type EntityConfigurationStatus = 'DRAFT' | 'READY';
export type EvaluationRunStatus = 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type EvolutionRunStatus =
  | 'DRAFT'
  | 'RUNNING'
  | 'COMPLETED'
  | 'POPULATION_COLLAPSE'
  | 'CANCELLED'
  | 'FAILED';

export type MarketDataSnapshotStatus = 'VALID' | 'SUPERSEDED' | 'COMPROMISED';
export type CapabilityState = 'AVAILABLE' | 'NOT_ENTITLED' | 'UNREACHABLE' | 'UNKNOWN';
export type PromotionDecisionValue = 'PROMOTE' | 'REJECT' | 'DEFER';
export type ArenaRole = 'DISCOVERY' | 'VALIDATION' | 'FINAL_HOLDOUT';
export type MutationOperator = 'VARIANT' | 'MUTATION';
export type ResearchValidity = 'VALID' | 'COMPROMISED_SOURCE';
export type AuditActorType = 'USER' | 'SYSTEM' | 'EVOLUTION' | 'BENCHMARK';
export type MarketAssetClass = 'US_EQUITY' | 'CRYPTO';
export type NotificationSeverity = 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface EntityTraits {
  [key: string]: string | number | boolean | null | EntityTraits | Array<string | number | boolean | null>;
}

export interface Entity {
  id: string;
  name: string;
  family: string | null;
  lifecycleState: LifecycleState;
  candidateStatus: CandidateStatus;
  evolutionRunId: string | null;
  birthEvolutionRunId: string | null;
  parentEntityId: string | null;
  mutationOperator: MutationOperator | null;
  configurationStatus: EntityConfigurationStatus;
  strategyType: string | null;
  strategyVersion: number | null;
  traits: EntityTraits;
  traitHash: string | null;
  createdAt: IsoTimestamp;
  retiredAt: IsoTimestamp | null;
}


export interface EntityTombstone {
  id: string;
  entityId: string;
  deletedAt: IsoTimestamp;
  lastKnownName: string;
  family: string | null;
  lifecycleAtDeletion: 'RETIRED';
  birthEvolutionRunId: string | null;
  parentEntityId: string | null;
  mutationOperator: MutationOperator | null;
  originalCreatedAt: IsoTimestamp;
}

export interface MarketBar {
  time: IsoTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount?: number;
  vwap?: number;
}

export interface MarketAsset {
  symbol: string;
  name: string;
  assetClass: MarketAssetClass;
  exchange: string | null;
  tradable: boolean;
  status: string;
}

export interface MarketQuote {
  symbol: string;
  assetClass: MarketAssetClass;
  timestamp: IsoTimestamp;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  provider: string;
  feed: string;
}

export interface MarketDataSnapshot {
  id: string;
  version: number;
  provider: string;
  feed: string;
  symbolUniverse: string[];
  timeframe: string;
  requestedStart: IsoTimestamp;
  requestedEnd: IsoTimestamp;
  actualStart: IsoTimestamp | null;
  actualEnd: IsoTimestamp | null;
  adjustmentMode: string;
  coverageMetadata: Record<string, string | number | boolean | null>;
  providerMetadata: Record<string, string | number | boolean | null>;
  fetchedAt: IsoTimestamp;
  contentHash: string;
  schemaVersion: number;
  status: MarketDataSnapshotStatus;
  supersedesSnapshotId: string | null;
  artifactPath: string;
}

export interface ExecutionPolicy {
  id: string;
  version: number;
  fillModel: 'NEXT_BAR_OPEN';
  terminalLiquidation: 'FINAL_BAR_CLOSE';
  fractionalShares: true;
  longOnly: true;
  commissionPerTrade: number;
  slippageBps: number;
  maxExposure: number;
  createdAt: IsoTimestamp;
}

export interface RewardPolicy {
  id: string;
  version: number;
  lambda: number;
  benchmark: 'BUY_AND_HOLD';
  maxDrawdownGate: number;
  minimumTradeCount: number;
  maxExposureGate: number;
  requireExecutionValidity: boolean;
  requireDataIntegrity: boolean;
  createdAt: IsoTimestamp;
}

export interface Arena {
  id: string;
  rootArenaId: string;
  version: number;
  name: string;
  marketDataSnapshotIds: string[];
  symbolUniverse: string[];
  timeframe: string;
  initialCapital: number;
  warmupBars: number;
  timeWindow: {
    start: IsoTimestamp;
    end: IsoTimestamp;
  };
  executionPolicyId: string;
  rewardPolicyId: string;
  /** Compatibility mirrors retained for older read-only surfaces. */
  executionCostModel: {
    commissionPerTrade: number;
    slippageBps: number;
  };
  scoringConfig: {
    rewardPolicyVersion: string;
    hardGatePolicyVersion: string;
  };
  createdAt: IsoTimestamp;
}

export interface EvaluationRun {
  id: string;
  entityId: string;
  arenaVersionId: string;
  status: EvaluationRunStatus;
  createdAt: IsoTimestamp;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
  cancelledAt: IsoTimestamp | null;
  failedAt: IsoTimestamp | null;
  experienceId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
}

export interface HardGateResult {
  gate: string;
  passed: boolean;
  observedValue: number | string | boolean | null;
  limit: number | string | boolean | null;
  reason: string | null;
}

export interface RewardComponents {
  excessReturn: number;
  lambda: number;
  drawdownPenalty: number;
  reward: number;
}

export interface ExperienceTracePoint {
  timestamp: IsoTimestamp;
  symbol: string;
  isWarmup: boolean;
  isEvaluated: boolean;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  cash: number;
  quantity: number;
  marketValue: number;
  equity: number;
  exposure: number;
  realizedPnl: number;
  unrealizedPnl: number;
  drawdown: number;
  benchmarkEquity: number | null;
  decisionTarget: number | null;
  fillQuantity: number | null;
  fillPrice: number | null;
  fastMa: number | null;
  slowMa: number | null;
}

export interface ExperienceTrace {
  id: string;
  experienceId: string;
  symbol: string;
  points: ExperienceTracePoint[];
  createdAt: IsoTimestamp;
}

export interface EvaluationSuiteEntry {
  arenaVersionId: string;
  role: ArenaRole;
}

export interface EvaluationSuite {
  id: string;
  version: number;
  name: string;
  entries: EvaluationSuiteEntry[];
  createdAt: IsoTimestamp;
}

export interface Experience {
  id: string;
  entityId: string;
  arenaVersionId: string;
  marketDataSnapshotIds: string[];
  evolutionRunId: string | null;
  evolutionPolicyVersionId: string | null;
  evaluationSuiteVersionId: string | null;
  startedAt: IsoTimestamp;
  completedAt: IsoTimestamp | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  reward: number | null;
  excessReturn: number | null;
  maxDrawdown: number | null;
  hardGatePassed: boolean | null;
  hardGateFailures: string[];
  policyVersions: Record<string, string>;
  researchValidity: ResearchValidity;
  evaluationRunId?: string;
  arenaVersion?: number;
  startingCapital?: number;
  endingEquity?: number;
  totalReturn?: number;
  benchmarkReturn?: number;
  tradeCount?: number;
  hardGateResults?: HardGateResult[];
  rewardComponents?: RewardComponents;
  strategyType?: string;
  strategyVersion?: number;
  strategyTraits?: EntityTraits;
  traitHash?: string;
  executionPolicyId?: string;
  executionPolicyVersion?: number;
  rewardPolicyId?: string;
  rewardPolicyVersion?: number;
  executionEngineVersion?: string;
  indicatorLibraryVersion?: string;
  marketDataContentHashes?: string[];
  traceId?: string;
}

export interface ExperienceEvent {
  id: string;
  experienceId: string;
  sequence: number;
  timestamp: IsoTimestamp;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface MarketMemoryCell {
  id: string;
  entityId: string;
  regimeKey: string;
  evidenceExperienceIds: string[];
  approval: number;
  reliability: number;
  effectiveSampleSize: number;
  lastExperienceAt: IsoTimestamp | null;
  projectionVersion: string;
}

export interface EvolutionPolicy {
  id: string;
  version: number;
  maxActivePopulation: number;
  minViablePopulation: number;
  maxExperiences: number;
  minSurvivalAge: number;
  survivalRewardFloor: number;
  minBreedingAge: number;
  breedingTopPercentile: number;
  maxChildrenPerParentPerCycle: number;
  maxLifetimeOffspring: number;
  variantProbability: number;
  mutationProbability: number;
  rewardLambda: number;
  createdAt: IsoTimestamp;
}

export interface EvolutionRun {
  id: string;
  status: EvolutionRunStatus;
  evaluationSuiteVersionId: string;
  evolutionPolicyVersionId: string;
  proposerType: 'EVOLUTION' | 'RANDOM' | 'QUASI_GRID' | 'BAYESIAN';
  proposerPolicyVersion: string;
  cycle: number;
  activeCandidateCount: number;
  createdAt: IsoTimestamp;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
}

export interface PromotionComparisonSnapshot {
  medianValidationReward: number;
  worstValidationDrawdown: number;
  consistency: number;
  coverage: string;
}

export interface PromotionDecision {
  id: string;
  entityId: string;
  decision: PromotionDecisionValue;
  validationSuiteVersionId: string;
  promotionPolicyVersion: string;
  comparison: PromotionComparisonSnapshot;
  reviewerNote: string | null;
  createdAt: IsoTimestamp;
}

export interface TraitProposal {
  proposalId: string;
  traits: EntityTraits;
  parentEntityId: string | null;
  operator: MutationOperator | null;
}

export interface ProposalResult {
  proposalId: string;
  entityId: string;
  reward: number | null;
  hardGatePassed: boolean;
  terminalReason: string | null;
}

export interface ProposerState {
  proposerType: string;
  version: string;
  state: Record<string, unknown>;
}

export interface CandidateProposer {
  initialize(searchSpace: Record<string, unknown>, seed: number, policy: Record<string, unknown>): void | Promise<void>;
  ask(count: number, context: Record<string, unknown>): TraitProposal[] | Promise<TraitProposal[]>;
  tell(results: ProposalResult[]): void | Promise<void>;
  snapshotState(): ProposerState;
}

export interface NotificationEvent {
  id: string;
  createdAt: IsoTimestamp;
  severity: NotificationSeverity;
  category: string;
  title: string;
  message: string;
  seen: boolean;
  dismissed: boolean;
  correlationId: string | null;
  auditEventId: string | null;
  target: {
    type: string;
    id: string | null;
    route: string | null;
  } | null;
}

export interface AuditEvent {
  id: string;
  sequence: number;
  occurredAt: IsoTimestamp;
  eventType: string;
  actor: {
    type: AuditActorType;
    id: string | null;
  };
  subject: {
    type: string;
    id: string;
    version: number | null;
  };
  correlationId: string;
  causationId: string | null;
  summary: string;
  details: Record<string, unknown>;
  beforeHash: string | null;
  afterHash: string | null;
  previousEventHash: string | null;
  eventHash: string;
  schemaVersion: number;
}
