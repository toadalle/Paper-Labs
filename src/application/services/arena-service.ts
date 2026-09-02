import { createId } from '../../domain/id.js';
import { ARENA_CREATE_DEFAULTS } from '../../domain/create-defaults.js';
import { assertArena } from '../../domain/invariants.js';
import type { Arena, ExecutionPolicy, MarketDataSnapshot, RewardPolicy } from '../../domain/types.js';
import { canonicalJson, sha256 } from '../../infrastructure/hash.js';
import type { AuditService } from '../../infrastructure/audit/audit-service.js';
import type { Repository } from '../../infrastructure/persistence/repository.js';
import type { MarketDataSnapshotService } from '../../infrastructure/market-data/snapshots.js';

export interface CreateArenaInput {
  name: string;
  symbol: string;
  timeframe?: string;
  start: string;
  end: string;
  initialCapital?: number;
  warmupBars?: number;
  commissionPerTrade?: number;
  slippageBps?: number;
  rewardLambda?: number;
  maxDrawdownGate?: number;
  minimumTradeCount?: number;
  feed?: string;
  baseArenaId?: string | null;
}

export interface NormalizedArenaInput {
  name: string;
  symbol: string;
  timeframe: '1Day';
  start: string;
  end: string;
  initialCapital: number;
  warmupBars: number;
  commissionPerTrade: number;
  slippageBps: number;
  rewardLambda: number;
  maxDrawdownGate: number;
  minimumTradeCount: number;
  feed: string;
  baseArenaId: string | null;
}

export interface PreparedArenaInput {
  input: NormalizedArenaInput;
  snapshot: MarketDataSnapshot;
}

export class ArenaService {
  constructor(
    private readonly repository: Repository,
    private readonly snapshots: MarketDataSnapshotService,
    private readonly audit: AuditService
  ) {}

  normalize(input: CreateArenaInput): NormalizedArenaInput {
    const name = input.name.trim();
    const symbol = input.symbol.trim().toUpperCase();
    if (!name) throw new Error('Arena name is required.');
    if (!symbol) throw new Error('Arena symbol is required.');

    const requestedBaseArenaId = input.baseArenaId?.trim() || null;
    if (requestedBaseArenaId && !this.repository.getArena(requestedBaseArenaId)) throw new Error('Base Arena version not found.');

    const start = normalizeStart(input.start);
    const end = normalizeEnd(input.end);
    if (!(Date.parse(start) < Date.parse(end))) throw new Error('Arena start must be before end.');

    const timeframe = input.timeframe?.trim() || ARENA_CREATE_DEFAULTS.timeframe;
    if (timeframe !== '1Day') throw new Error('Executable Research V1 supports 1Day Arenas only.');

    return {
      name,
      symbol,
      timeframe: '1Day',
      start,
      end,
      initialCapital: finitePositive(input.initialCapital ?? ARENA_CREATE_DEFAULTS.initialCapital, 'Initial capital'),
      warmupBars: integerRange(input.warmupBars ?? ARENA_CREATE_DEFAULTS.warmupBars, 0, 1000, 'Warmup bars'),
      commissionPerTrade: nonNegative(input.commissionPerTrade ?? ARENA_CREATE_DEFAULTS.commissionPerTrade, 'Commission per trade'),
      slippageBps: nonNegative(input.slippageBps ?? ARENA_CREATE_DEFAULTS.slippageBps, 'Slippage bps'),
      rewardLambda: nonNegative(input.rewardLambda ?? ARENA_CREATE_DEFAULTS.rewardLambda, 'Reward lambda'),
      maxDrawdownGate: range(input.maxDrawdownGate ?? ARENA_CREATE_DEFAULTS.maxDrawdownGate, 0, 1, 'Max drawdown gate'),
      minimumTradeCount: integerRange(input.minimumTradeCount ?? ARENA_CREATE_DEFAULTS.minimumTradeCount, 0, 100000, 'Minimum trade count'),
      feed: input.feed?.trim() || 'iex',
      baseArenaId: requestedBaseArenaId
    };
  }

  async prepare(input: CreateArenaInput, correlationId: string): Promise<PreparedArenaInput> {
    const normalized = this.normalize(input);
    const base = normalized.baseArenaId ? this.repository.getArena(normalized.baseArenaId) : null;
    if (base && base.symbolUniverse[0] === normalized.symbol && base.timeframe === normalized.timeframe && base.timeWindow.start === normalized.start && base.timeWindow.end === normalized.end && base.warmupBars === normalized.warmupBars) {
      const existingSnapshot = base.marketDataSnapshotIds[0] ? this.repository.getMarketDataSnapshot(base.marketDataSnapshotIds[0]) : null;
      if (existingSnapshot && existingSnapshot.status !== 'COMPROMISED') return { input: normalized, snapshot: existingSnapshot };
    }
    const captureStart = subtractCalendarDays(normalized.start, Math.max(7, normalized.warmupBars * 3 + 14));
    const snapshot = await this.snapshots.capture({
      symbol: normalized.symbol,
      assetClass: 'US_EQUITY',
      timeframe: normalized.timeframe,
      start: captureStart,
      end: normalized.end,
      feed: normalized.feed,
      adjustmentMode: 'split'
    }, correlationId);
    return { input: normalized, snapshot };
  }

  async create(input: CreateArenaInput, correlationId: string): Promise<Arena> {
    return this.commitPrepared(await this.prepare(input, correlationId), correlationId);
  }

  commitPrepared(prepared: PreparedArenaInput, correlationId: string): Arena {
    return this.repository.withTransaction(() => {
      const base = prepared.input.baseArenaId ? this.repository.getArena(prepared.input.baseArenaId) : null;
      if (prepared.input.baseArenaId && !base) throw new Error('Base Arena version not found.');
      const now = new Date().toISOString();
      const executionPolicy = buildExecutionPolicy(prepared.input, now);
      const rewardPolicy = buildRewardPolicy(prepared.input, now);
      const id = createId('arena');
      const rootArenaId = base?.rootArenaId ?? id;
      const version = base
        ? Math.max(...this.repository.listArenas().filter(item => item.rootArenaId === rootArenaId).map(item => item.version), 0) + 1
        : 1;
      const arena = buildArena(id, rootArenaId, version, prepared, executionPolicy, rewardPolicy, now);
      this.repository.saveExecutionPolicy(executionPolicy);
      this.repository.saveRewardPolicy(rewardPolicy);
      this.repository.saveArena(arena);
      this.audit.record({
        eventType: base ? 'ARENA_VERSION_CREATED' : 'ARENA_CREATED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Arena', id: arena.id, version: arena.version },
        correlationId,
        causationId: base?.id ?? null,
        summary: base ? `Created ${arena.name} v${arena.version}.` : `Created Arena ${arena.name}.`,
        details: auditDetails(prepared, arena, executionPolicy, rewardPolicy, base?.id ?? null),
        beforeHash: base ? sha256(canonicalJson(base)) : null,
        afterHash: sha256(canonicalJson(arena))
      });
      return arena;
    });
  }

  patchUnusedPrepared(targetId: string, prepared: PreparedArenaInput, correlationId: string): Arena {
    return this.repository.withTransaction(() => {
      const current = this.repository.getArena(targetId);
      if (!current) throw new Error('Arena not found.');
      if (this.repository.isLocked('arena', targetId)) throw new Error('Used Arena versions are immutable and must create a new version.');
      const now = new Date().toISOString();
      const executionPolicy = buildExecutionPolicy(prepared.input, now);
      const rewardPolicy = buildRewardPolicy(prepared.input, now);
      const arena = buildArena(current.id, current.rootArenaId, current.version, prepared, executionPolicy, rewardPolicy, current.createdAt);
      this.repository.saveExecutionPolicy(executionPolicy);
      this.repository.saveRewardPolicy(rewardPolicy);
      this.repository.saveArena(arena);
      this.audit.record({
        eventType: 'ARENA_UPDATED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Arena', id: arena.id, version: arena.version },
        correlationId,
        summary: `Updated unused Arena ${arena.name} v${arena.version}.`,
        details: auditDetails(prepared, arena, executionPolicy, rewardPolicy, null),
        beforeHash: sha256(canonicalJson(current)),
        afterHash: sha256(canonicalJson(arena))
      });
      return arena;
    });
  }
}

function buildExecutionPolicy(input: NormalizedArenaInput, now: string): ExecutionPolicy {
  return {
    id: createId('execution_policy'), version: 1, fillModel: 'NEXT_BAR_OPEN', terminalLiquidation: 'FINAL_BAR_CLOSE',
    fractionalShares: true, longOnly: true, commissionPerTrade: input.commissionPerTrade, slippageBps: input.slippageBps,
    maxExposure: 1, createdAt: now
  };
}

function buildRewardPolicy(input: NormalizedArenaInput, now: string): RewardPolicy {
  return {
    id: createId('reward_policy'), version: 1, lambda: input.rewardLambda, benchmark: 'BUY_AND_HOLD',
    maxDrawdownGate: input.maxDrawdownGate, minimumTradeCount: input.minimumTradeCount, maxExposureGate: 1,
    requireExecutionValidity: true, requireDataIntegrity: true, createdAt: now
  };
}

function buildArena(id: string, rootArenaId: string, version: number, prepared: PreparedArenaInput, executionPolicy: ExecutionPolicy, rewardPolicy: RewardPolicy, createdAt: string): Arena {
  const input = prepared.input;
  return assertArena({
    id, rootArenaId, version, name: input.name, marketDataSnapshotIds: [prepared.snapshot.id], symbolUniverse: [input.symbol],
    timeframe: input.timeframe, initialCapital: input.initialCapital, warmupBars: input.warmupBars,
    timeWindow: { start: input.start, end: input.end }, executionPolicyId: executionPolicy.id, rewardPolicyId: rewardPolicy.id,
    executionCostModel: { commissionPerTrade: input.commissionPerTrade, slippageBps: input.slippageBps },
    scoringConfig: { rewardPolicyVersion: `reward-policy-v${rewardPolicy.version}`, hardGatePolicyVersion: `reward-policy-v${rewardPolicy.version}` },
    createdAt
  });
}

function auditDetails(prepared: PreparedArenaInput, arena: Arena, executionPolicy: ExecutionPolicy, rewardPolicy: RewardPolicy, baseArenaId: string | null): Record<string, unknown> {
  return {
    rootArenaId: arena.rootArenaId, baseArenaId, symbol: prepared.input.symbol, timeframe: prepared.input.timeframe,
    start: prepared.input.start, end: prepared.input.end, snapshotId: prepared.snapshot.id,
    provider: prepared.snapshot.provider, feed: prepared.snapshot.feed,
    executionPolicyId: executionPolicy.id, rewardPolicyId: rewardPolicy.id
  };
}

function normalizeStart(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00.000Z`;
  const time = Date.parse(trimmed);
  if (!Number.isFinite(time)) throw new Error('Arena start is invalid.');
  return new Date(time).toISOString();
}

function normalizeEnd(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T23:59:59.999Z`;
  const time = Date.parse(trimmed);
  if (!Number.isFinite(time)) throw new Error('Arena end is invalid.');
  return new Date(time).toISOString();
}

function subtractCalendarDays(value: string, days: number): string {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}
function finitePositive(value: number, label: string): number { if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be > 0.`); return value; }
function nonNegative(value: number, label: string): number { if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be non-negative.`); return value; }
function range(value: number, min: number, max: number, label: string): number { if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`); return value; }
function integerRange(value: number, min: number, max: number, label: string): number { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label} must be an integer between ${min} and ${max}.`); return value; }
