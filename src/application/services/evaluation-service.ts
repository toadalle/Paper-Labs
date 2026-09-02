import { createId } from '../../domain/id.js';
import { assertEntity, assertExperience } from '../../domain/invariants.js';
import { computeReward } from '../../domain/reward.js';
import { INDICATOR_LIBRARY_VERSION } from '../../domain/strategy/indicators.js';
import { strategyRegistry } from '../../domain/strategy/registry.js';
import type { StrategyDefinition } from '../../domain/strategy/types.js';
import type {
  Arena,
  Entity,
  EvaluationRun,
  ExecutionPolicy,
  Experience,
  ExperienceEvent,
  ExperienceTrace,
  ExperienceTracePoint,
  HardGateResult,
  MarketBar,
  RewardPolicy
} from '../../domain/types.js';
import type { AuditService } from '../../infrastructure/audit/audit-service.js';
import { canonicalJson, sha256 } from '../../infrastructure/hash.js';
import type { MarketDataSnapshotService } from '../../infrastructure/market-data/snapshots.js';
import type { Repository } from '../../infrastructure/persistence/repository.js';

export const EXECUTION_ENGINE_VERSION = '1.0.0';

interface CoreEvent {
  timestamp: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface EvaluationCoreResult {
  endingEquity: number;
  totalReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  maxDrawdown: number;
  tradeCount: number;
  reward: number;
  hardGateResults: HardGateResult[];
  hardGatePassed: boolean;
  events: CoreEvent[];
  tracePoints: ExperienceTracePoint[];
}

interface SimulationAccount {
  cash: number;
  quantity: number;
  averageEntryPrice: number;
  realizedPnl: number;
  peakEquity: number;
  maxDrawdown: number;
}

export class EvaluationService {
  constructor(
    private readonly repository: Repository,
    private readonly snapshots: MarketDataSnapshotService,
    private readonly audit: AuditService
  ) {}

  async run(entityId: string, arenaId: string, correlationId: string): Promise<{ run: EvaluationRun; experience: Experience }> {
    const entity = this.repository.getEntity(entityId);
    if (!entity) throw new Error('Entity not found.');
    assertEntity(entity);
    if (entity.lifecycleState !== 'CANDIDATE' || entity.candidateStatus !== 'ACTIVE') throw new Error('Only active Candidate entities may be evaluated in Executable Research V1.');
    if (entity.configurationStatus !== 'READY') throw new Error('Entity must be READY before evaluation.');
    if (!entity.strategyType || !entity.strategyVersion || !entity.traitHash) throw new Error('READY Entity is missing immutable strategy identity.');

    const arena = this.repository.getArena(arenaId);
    if (!arena) throw new Error('Arena not found.');
    const executionPolicy = this.repository.getExecutionPolicy(arena.executionPolicyId);
    if (!executionPolicy) throw new Error('Arena ExecutionPolicy not found.');
    const rewardPolicy = this.repository.getRewardPolicy(arena.rewardPolicyId);
    if (!rewardPolicy) throw new Error('Arena RewardPolicy not found.');
    const snapshotId = arena.marketDataSnapshotIds[0];
    if (!snapshotId) throw new Error('Arena has no MarketDataSnapshot.');
    const snapshot = this.repository.getMarketDataSnapshot(snapshotId);
    if (!snapshot) throw new Error('Arena MarketDataSnapshot not found.');
    if (snapshot.status === 'COMPROMISED') throw new Error('Arena MarketDataSnapshot is compromised.');

    const strategy = strategyRegistry.get(entity.strategyType, entity.strategyVersion);
    strategy.validateTraits(entity.traits);

    const runId = createId('evaluation_run');
    const startedAt = new Date().toISOString();
    const running: EvaluationRun = {
      id: runId,
      entityId: entity.id,
      arenaVersionId: arena.id,
      status: 'RUNNING',
      createdAt: startedAt,
      startedAt,
      completedAt: null,
      cancelledAt: null,
      failedAt: null,
      experienceId: null,
      failureCode: null,
      failureMessage: null
    };
    this.repository.withTransaction(() => {
      this.repository.saveEvaluationRun(running);
      this.audit.record({
        eventType: 'EVALUATION_RUN_STARTED',
        actor: { type: 'USER', id: null },
        subject: { type: 'EvaluationRun', id: runId },
        correlationId,
        summary: `Started evaluation of ${entity.name} in ${arena.name}.`,
        details: { entityId: entity.id, arenaId: arena.id, snapshotId },
        beforeHash: null,
        afterHash: sha256(canonicalJson(running))
      });
    });

    try {
      const bars = await this.snapshots.loadBars(snapshot);
      this.assertRunActive(runId);
      const result = executeEvaluationCore({ entity, arena, executionPolicy, rewardPolicy, strategy, bars });
      this.assertRunActive(runId);
      const experienceId = createId('experience');
      const traceId = createId('experience_trace');
      const completedAt = new Date().toISOString();
      const experience = assertExperience({
        id: experienceId,
        entityId: entity.id,
        arenaVersionId: arena.id,
        marketDataSnapshotIds: [snapshot.id],
        evolutionRunId: null,
        evolutionPolicyVersionId: null,
        evaluationSuiteVersionId: null,
        startedAt,
        completedAt,
        status: 'COMPLETED',
        reward: result.reward,
        excessReturn: result.excessReturn,
        maxDrawdown: result.maxDrawdown,
        hardGatePassed: result.hardGatePassed,
        hardGateFailures: result.hardGateResults.filter(item => !item.passed).map(item => item.gate),
        policyVersions: {
          execution: `${executionPolicy.id}@${executionPolicy.version}`,
          reward: `${rewardPolicy.id}@${rewardPolicy.version}`,
          executionEngine: EXECUTION_ENGINE_VERSION,
          indicatorLibrary: INDICATOR_LIBRARY_VERSION
        },
        researchValidity: 'VALID',
        evaluationRunId: runId,
        arenaVersion: arena.version,
        startingCapital: arena.initialCapital,
        endingEquity: result.endingEquity,
        totalReturn: result.totalReturn,
        benchmarkReturn: result.benchmarkReturn,
        tradeCount: result.tradeCount,
        hardGateResults: result.hardGateResults,
        rewardComponents: {
          excessReturn: result.excessReturn,
          lambda: rewardPolicy.lambda,
          drawdownPenalty: rewardPolicy.lambda * result.maxDrawdown,
          reward: result.reward
        },
        strategyType: entity.strategyType,
        strategyVersion: entity.strategyVersion,
        strategyTraits: structuredClone(entity.traits),
        traitHash: entity.traitHash,
        executionPolicyId: executionPolicy.id,
        executionPolicyVersion: executionPolicy.version,
        rewardPolicyId: rewardPolicy.id,
        rewardPolicyVersion: rewardPolicy.version,
        executionEngineVersion: EXECUTION_ENGINE_VERSION,
        indicatorLibraryVersion: INDICATOR_LIBRARY_VERSION,
        marketDataContentHashes: [snapshot.contentHash],
        traceId
      });
      const trace: ExperienceTrace = {
        id: traceId,
        experienceId,
        symbol: arena.symbolUniverse[0]!,
        points: result.tracePoints,
        createdAt: completedAt
      };
      const events: ExperienceEvent[] = result.events.map((event, index) => ({
        id: createId('experience_event'),
        experienceId,
        sequence: index + 1,
        timestamp: event.timestamp,
        eventType: event.eventType,
        payload: event.payload
      }));
      const completedRun: EvaluationRun = {
        ...running,
        status: 'COMPLETED',
        completedAt,
        experienceId
      };

      this.repository.withTransaction(() => {
        this.repository.saveExperience(experience);
        for (const event of events) this.repository.saveExperienceEvent(event);
        this.repository.saveExperienceTrace(trace);
        this.repository.saveEvaluationRun(completedRun);
        this.audit.record({
          eventType: 'EVALUATION_COMPLETED',
          actor: { type: 'SYSTEM', id: null },
          subject: { type: 'Experience', id: experience.id },
          correlationId,
          causationId: runId,
          summary: `Completed evaluation of ${entity.name} in ${arena.name}.`,
          details: {
            evaluationRunId: runId,
            reward: result.reward,
            hardGatePassed: result.hardGatePassed,
            snapshotId: snapshot.id,
            snapshotContentHash: snapshot.contentHash,
            executionEngineVersion: EXECUTION_ENGINE_VERSION,
            indicatorLibraryVersion: INDICATOR_LIBRARY_VERSION
          },
          beforeHash: null,
          afterHash: sha256(canonicalJson(experience))
        });
      });
      return { run: completedRun, experience };
    } catch (error) {
      const current = this.repository.getEvaluationRun(runId);
      if (!current || current.status !== 'RUNNING') {
        // A concurrent terminal transition (notably user cancellation while market data is loading)
        // owns the run outcome. Never rewrite CANCELLED/COMPLETED state as FAILED.
        throw error;
      }
      const failedAt = new Date().toISOString();
      const failed: EvaluationRun = {
        ...current,
        status: 'FAILED',
        failedAt,
        failureCode: classifyFailure(error),
        failureMessage: error instanceof Error ? error.message : String(error)
      };
      this.repository.withTransaction(() => {
        this.repository.saveEvaluationRun(failed);
        this.audit.record({
          eventType: 'EVALUATION_FAILED',
          actor: { type: 'SYSTEM', id: null },
          subject: { type: 'EvaluationRun', id: runId },
          correlationId,
          summary: `Evaluation failed for ${entity.name} in ${arena.name}.`,
          details: { failureCode: failed.failureCode, failureMessage: failed.failureMessage },
          beforeHash: sha256(canonicalJson(current)),
          afterHash: sha256(canonicalJson(failed))
        });
      });
      throw error;
    }
  }

  private assertRunActive(runId: string): void {
    const current = this.repository.getEvaluationRun(runId);
    if (!current || current.status !== 'RUNNING') throw new Error('EvaluationRun is no longer active.');
  }

  cancel(runId: string, correlationId: string): EvaluationRun {
    return this.repository.withTransaction(() => {
      const current = this.repository.getEvaluationRun(runId);
      if (!current) throw new Error('EvaluationRun not found.');
      if (current.status !== 'RUNNING' && current.status !== 'DRAFT') throw new Error('Only active EvaluationRuns may be cancelled.');
      const next: EvaluationRun = { ...current, status: 'CANCELLED', cancelledAt: new Date().toISOString() };
      this.repository.saveEvaluationRun(next);
      this.audit.record({
        eventType: 'EVALUATION_CANCELLED',
        actor: { type: 'USER', id: null },
        subject: { type: 'EvaluationRun', id: runId },
        correlationId,
        summary: 'Cancelled EvaluationRun; no Experience was produced.',
        details: { entityId: current.entityId, arenaId: current.arenaVersionId },
        beforeHash: sha256(canonicalJson(current)),
        afterHash: sha256(canonicalJson(next))
      });
      return next;
    });
  }
}

export function executeEvaluationCore(input: {
  entity: Entity;
  arena: Arena;
  executionPolicy: ExecutionPolicy;
  rewardPolicy: RewardPolicy;
  strategy: StrategyDefinition;
  bars: MarketBar[];
}): EvaluationCoreResult {
  const { entity, arena, executionPolicy, rewardPolicy, strategy } = input;
  if (entity.configurationStatus !== 'READY') throw new Error('DRAFT Entity cannot be evaluated.');
  if (executionPolicy.fillModel !== 'NEXT_BAR_OPEN') throw new Error('Unsupported fill model.');
  if (executionPolicy.terminalLiquidation !== 'FINAL_BAR_CLOSE') throw new Error('Unsupported terminal liquidation model.');
  if (!executionPolicy.longOnly) throw new Error('Executable Research V1 requires long-only ExecutionPolicy.');
  const symbol = arena.symbolUniverse[0];
  if (!symbol) throw new Error('Arena symbol is missing.');
  const sorted = [...input.bars].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const startMs = Date.parse(arena.timeWindow.start);
  const endMs = Date.parse(arena.timeWindow.end);
  const firstEvaluatedIndex = sorted.findIndex(bar => Date.parse(bar.time) >= startMs);
  if (firstEvaluatedIndex < 0) throw new Error('Snapshot does not contain Arena.start.');
  const evaluated = sorted.filter(bar => Date.parse(bar.time) >= startMs && Date.parse(bar.time) <= endMs);
  if (evaluated.length < 2) throw new Error('Arena requires at least two evaluated bars for next-bar-open execution.');
  const requiredWarmup = Math.max(arena.warmupBars, strategy.requiredWarmupBars(entity.traits));
  const beforeStart = sorted.slice(0, firstEvaluatedIndex);
  if (beforeStart.length < requiredWarmup) {
    throw new Error(`Snapshot has ${beforeStart.length} warmup bars; ${requiredWarmup} required.`);
  }
  const warmup = beforeStart.slice(beforeStart.length - requiredWarmup);

  const account: SimulationAccount = {
    cash: arena.initialCapital,
    quantity: 0,
    averageEntryPrice: 0,
    realizedPnl: 0,
    peakEquity: arena.initialCapital,
    maxDrawdown: 0
  };
  const tracePoints: ExperienceTracePoint[] = warmup.map(bar => tracePoint({
    bar,
    symbol,
    isWarmup: true,
    isEvaluated: false,
    account,
    benchmarkEquity: null,
    decisionTarget: null,
    fillQuantity: null,
    fillPrice: null,
    fastMa: null,
    slowMa: null
  }));
  const events: CoreEvent[] = [{
    timestamp: evaluated[0]!.time,
    eventType: 'EXPERIENCE_STARTED',
    payload: { symbol, arenaId: arena.id, warmupBars: requiredWarmup }
  }];

  let pendingTarget: number | null = null;
  let tradeCount = 0;
  let maxExposureObserved = 0;
  let currentTargetFraction = 0;
  const firstBenchmarkPrice = evaluated[0]!.open;

  for (let index = 0; index < evaluated.length; index += 1) {
    const bar = evaluated[index]!;
    let fillQuantity: number | null = null;
    let fillPrice: number | null = null;

    if (pendingTarget !== null) {
      const fill = rebalanceAtPrice(account, pendingTarget, bar.open, executionPolicy);
      currentTargetFraction = pendingTarget;
      pendingTarget = null;
      if (fill) {
        fillQuantity = fill.quantityDelta;
        fillPrice = fill.executionPrice;
        tradeCount += 1;
        events.push({
          timestamp: bar.time,
          eventType: 'FILL_EXECUTED',
          payload: {
            symbol,
            quantityDelta: fill.quantityDelta,
            executionPrice: fill.executionPrice,
            referencePrice: bar.open,
            fee: fill.fee,
            effect: fill.quantityDelta > 0 ? 'INCREASE' : 'DECREASE',
            targetFraction: currentTargetFraction,
            resultingExposure: exposureAtPrice(account, fill.executionPrice)
          }
        });
      }
    }

    const marketValue = account.quantity * bar.close;
    let equity = account.cash + marketValue;
    updateDrawdown(account, equity);
    const exposure = equity > 0 ? marketValue / equity : 0;
    maxExposureObserved = Math.max(maxExposureObserved, exposure);
    const benchmarkEquity = arena.initialCapital * (bar.close / firstBenchmarkPrice);

    let decisionTarget: number | null = null;
    let fastMa: number | null = null;
    let slowMa: number | null = null;
    if (index < evaluated.length - 1) {
      const currentGlobalIndex = firstEvaluatedIndex + index;
      const boundedHistory = sorted.slice(0, currentGlobalIndex + 1);
      const decisionResult = strategy.decide({
        symbol,
        observation: { [symbol]: bar },
        history: { [symbol]: boundedHistory },
        traits: entity.traits,
        currentTargetFraction
      });
      validateDecision(decisionResult.decision, executionPolicy);
      if (decisionResult.decision.type === 'TARGET_POSITION') {
        pendingTarget = decisionResult.decision.targetFraction;
        decisionTarget = pendingTarget;
      }
      fastMa = finiteOrNull(decisionResult.indicators.fast_ma);
      slowMa = finiteOrNull(decisionResult.indicators.slow_ma);
      events.push({
        timestamp: bar.time,
        eventType: 'DECISION_EMITTED',
        payload: {
          symbol,
          decision: decisionResult.decision,
          indicators: decisionResult.indicators
        }
      });
    }

    const isFinal = index === evaluated.length - 1;
    if (isFinal && account.quantity > 1e-12) {
      const terminal = rebalanceAtPrice(account, 0, bar.close, executionPolicy);
      if (terminal) {
        fillQuantity = terminal.quantityDelta;
        fillPrice = terminal.executionPrice;
        events.push({
          timestamp: bar.time,
          eventType: 'FORCED_LIQUIDATION',
          payload: {
            symbol,
            quantityDelta: terminal.quantityDelta,
            executionPrice: terminal.executionPrice,
            referencePrice: bar.close,
            fee: terminal.fee,
            effect: 'EXIT',
            targetFraction: 0,
            resultingExposure: 0
          }
        });
      }
      equity = account.cash;
      updateDrawdown(account, equity);
    }

    tracePoints.push(tracePoint({
      bar,
      symbol,
      isWarmup: false,
      isEvaluated: true,
      account,
      benchmarkEquity,
      decisionTarget,
      fillQuantity,
      fillPrice,
      fastMa,
      slowMa
    }));
  }

  const endingEquity = account.cash + account.quantity * evaluated.at(-1)!.close;
  const totalReturn = endingEquity / arena.initialCapital - 1;
  const finalBenchmarkEquity = arena.initialCapital * (evaluated.at(-1)!.close / firstBenchmarkPrice);
  const benchmarkReturn = finalBenchmarkEquity / arena.initialCapital - 1;
  const excessReturn = totalReturn - benchmarkReturn;
  const reward = computeReward({ excessReturn, maxDrawdown: account.maxDrawdown, lambda: rewardPolicy.lambda });
  const hardGateResults: HardGateResult[] = [
    gate('MAX_DRAWDOWN', account.maxDrawdown <= rewardPolicy.maxDrawdownGate, account.maxDrawdown, rewardPolicy.maxDrawdownGate, 'Maximum drawdown must remain within the RewardPolicy limit.'),
    gate('MINIMUM_ACTIVITY', tradeCount >= rewardPolicy.minimumTradeCount, tradeCount, rewardPolicy.minimumTradeCount, 'Trade count must meet the RewardPolicy minimum.'),
    gate('MAX_EXPOSURE', maxExposureObserved <= Math.min(executionPolicy.maxExposure, rewardPolicy.maxExposureGate) + 1e-9, maxExposureObserved, Math.min(executionPolicy.maxExposure, rewardPolicy.maxExposureGate), 'Exposure must remain within policy limits.'),
    gate('EXECUTION_VALIDITY', true, true, true, 'Execution invariants completed without failure.'),
    gate('DATA_INTEGRITY', true, true, true, 'Snapshot content hash was verified before execution.')
  ];
  for (const item of hardGateResults.filter(item => !item.passed)) {
    events.push({ timestamp: evaluated.at(-1)!.time, eventType: 'HARD_GATE_TRIGGERED', payload: { ...item } });
  }
  const hardGatePassed = hardGateResults.every(item => item.passed);
  events.push({
    timestamp: evaluated.at(-1)!.time,
    eventType: 'EXPERIENCE_COMPLETED',
    payload: { reward, totalReturn, benchmarkReturn, excessReturn, maxDrawdown: account.maxDrawdown, hardGatePassed }
  });

  return {
    endingEquity,
    totalReturn,
    benchmarkReturn,
    excessReturn,
    maxDrawdown: account.maxDrawdown,
    tradeCount,
    reward,
    hardGateResults,
    hardGatePassed,
    events,
    tracePoints
  };
}

function rebalanceAtPrice(account: SimulationAccount, targetFraction: number, referencePrice: number, policy: ExecutionPolicy): { quantityDelta: number; executionPrice: number; fee: number } | null {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) throw new Error('Execution reference price is invalid.');
  const currentEquity = account.cash + account.quantity * referencePrice;
  if (!Number.isFinite(currentEquity) || currentEquity <= 0) throw new Error('Simulation equity became non-positive or non-finite.');
  const side = targetFraction * currentEquity > account.quantity * referencePrice ? 1 : -1;
  const executionPrice = referencePrice * (1 + side * policy.slippageBps / 10_000);
  let desiredQuantity = targetFraction * currentEquity / executionPrice;
  if (!policy.fractionalShares) desiredQuantity = Math.floor(desiredQuantity);
  desiredQuantity = Math.max(0, desiredQuantity);
  let delta = desiredQuantity - account.quantity;
  if (Math.abs(delta) < 1e-12) return null;
  const fee = policy.commissionPerTrade;
  if (delta > 0) {
    const affordable = Math.max(0, (account.cash - fee) / executionPrice);
    delta = Math.min(delta, affordable);
  } else {
    delta = Math.max(delta, -account.quantity);
  }
  if (Math.abs(delta) < 1e-12) return null;

  if (delta > 0) {
    const oldCost = account.quantity * account.averageEntryPrice;
    const addedCost = delta * executionPrice;
    const newQuantity = account.quantity + delta;
    account.averageEntryPrice = newQuantity > 0 ? (oldCost + addedCost + fee) / newQuantity : 0;
  } else {
    const sold = -delta;
    account.realizedPnl += sold * (executionPrice - account.averageEntryPrice) - fee;
  }
  account.cash -= delta * executionPrice + fee;
  account.quantity += delta;
  if (account.quantity < 1e-10) {
    account.quantity = 0;
    account.averageEntryPrice = 0;
  }
  if (![account.cash, account.quantity, account.realizedPnl].every(Number.isFinite)) throw new Error('Simulation account state became non-finite.');
  return { quantityDelta: delta, executionPrice, fee };
}

function exposureAtPrice(account: SimulationAccount, price: number): number {
  const marketValue = account.quantity * price;
  const equity = account.cash + marketValue;
  return equity > 0 ? marketValue / equity : 0;
}

function tracePoint(input: {
  bar: MarketBar;
  symbol: string;
  isWarmup: boolean;
  isEvaluated: boolean;
  account: SimulationAccount;
  benchmarkEquity: number | null;
  decisionTarget: number | null;
  fillQuantity: number | null;
  fillPrice: number | null;
  fastMa: number | null;
  slowMa: number | null;
}): ExperienceTracePoint {
  const marketValue = input.account.quantity * input.bar.close;
  const equity = input.account.cash + marketValue;
  const unrealizedPnl = input.account.quantity * (input.bar.close - input.account.averageEntryPrice);
  const exposure = equity > 0 ? marketValue / equity : 0;
  return {
    timestamp: input.bar.time,
    symbol: input.symbol,
    isWarmup: input.isWarmup,
    isEvaluated: input.isEvaluated,
    open: input.bar.open,
    high: input.bar.high,
    low: input.bar.low,
    close: input.bar.close,
    volume: input.bar.volume,
    cash: input.account.cash,
    quantity: input.account.quantity,
    marketValue,
    equity,
    exposure,
    realizedPnl: input.account.realizedPnl,
    unrealizedPnl,
    drawdown: drawdownAt(input.account, equity),
    benchmarkEquity: input.benchmarkEquity,
    decisionTarget: input.decisionTarget,
    fillQuantity: input.fillQuantity,
    fillPrice: input.fillPrice,
    fastMa: input.fastMa,
    slowMa: input.slowMa
  };
}

function updateDrawdown(account: SimulationAccount, equity: number): void {
  if (!Number.isFinite(equity) || equity <= 0) throw new Error('Simulation equity became non-positive or non-finite.');
  account.peakEquity = Math.max(account.peakEquity, equity);
  const drawdown = drawdownAt(account, equity);
  account.maxDrawdown = Math.max(account.maxDrawdown, drawdown);
}

function drawdownAt(account: SimulationAccount, equity: number): number {
  return account.peakEquity > 0 ? Math.max(0, (account.peakEquity - equity) / account.peakEquity) : 0;
}

function validateDecision(decision: { type: string; targetFraction?: number }, policy: ExecutionPolicy): void {
  if (decision.type === 'HOLD') return;
  if (decision.type !== 'TARGET_POSITION') throw new Error('Strategy emitted an unsupported decision type.');
  const target = decision.targetFraction;
  if (typeof target !== 'number' || !Number.isFinite(target)) throw new Error('Strategy emitted a non-finite targetFraction.');
  if (target < 0 || target > policy.maxExposure || target > 1) throw new Error('Strategy emitted targetFraction outside long-only exposure limits.');
}

function gate(gateName: string, passed: boolean, observedValue: number | string | boolean, limit: number | string | boolean, reason: string): HardGateResult {
  return { gate: gateName, passed, observedValue, limit, reason: passed ? null : reason };
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function classifyFailure(error: unknown): string {
  const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (text.includes('snapshot') || text.includes('hash') || text.includes('warmup')) return 'DATA_INVALID';
  if (text.includes('strategy') || text.includes('decision')) return 'STRATEGY_INVALID';
  if (text.includes('equity') || text.includes('account') || text.includes('execution')) return 'EXECUTION_INVALID';
  return 'EVALUATION_FAILED';
}
