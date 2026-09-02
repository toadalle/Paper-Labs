import type { MarketBar } from '../types.js';

export const INDICATOR_LIBRARY_VERSION = '1.0.0';

export function simpleMovingAverage(bars: readonly MarketBar[], window: number): number | null {
  if (!Number.isInteger(window) || window < 1) throw new Error('SMA window must be a positive integer.');
  if (bars.length < window) return null;
  const slice = bars.slice(bars.length - window);
  const total = slice.reduce((sum, bar) => sum + bar.close, 0);
  return total / window;
}
