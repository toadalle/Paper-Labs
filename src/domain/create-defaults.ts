/**
 * Canonical create-time defaults shared by UI, HTTP/API callers, and future PLPS schema discovery.
 *
 * Keep this module declarative and side-effect free so it is safe to consume from both
 * server and client builds. Import/PLPS must never define a second set of defaults.
 */
export const ARENA_CREATE_DEFAULTS = Object.freeze({
  timeframe: '1Day',
  initialCapital: 10_000,
  warmupBars: 200,
  commissionPerTrade: 0,
  slippageBps: 1,
  rewardLambda: 1,
  maxDrawdownGate: 0.35,
  minimumTradeCount: 1
} as const);
