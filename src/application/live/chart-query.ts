import type { MarketAssetClass } from '../../domain/types.js';

export type LiveRange = '1D' | '5D' | '1M' | '3M' | 'YTD' | '1Y' | 'MAX';

export interface LiveChartQuery {
  range: LiveRange;
  timeframe: string;
  start: string;
  end: string;
}

export function resolveLiveChartQuery(range: LiveRange, assetClass: MarketAssetClass, now = new Date()): LiveChartQuery {
  const end = new Date(now);
  let start: Date;
  let timeframe: string;

  switch (range) {
    case '1D':
      start = addDays(end, assetClass === 'CRYPTO' ? -1 : -2);
      timeframe = '5Min';
      break;
    case '5D':
      start = addDays(end, assetClass === 'CRYPTO' ? -5 : -8);
      timeframe = '15Min';
      break;
    case '1M':
      start = addDays(end, -31);
      timeframe = '1Hour';
      break;
    case '3M':
      start = addDays(end, -93);
      timeframe = '1Day';
      break;
    case 'YTD':
      start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
      timeframe = '1Day';
      break;
    case '1Y':
      start = addDays(end, -366);
      timeframe = '1Day';
      break;
    case 'MAX':
      start = new Date(assetClass === 'CRYPTO' ? '2021-01-01T00:00:00.000Z' : '2016-01-01T00:00:00.000Z');
      timeframe = '1Day';
      break;
    default: {
      const exhaustive: never = range;
      throw new Error(`Unsupported Live range: ${String(exhaustive)}`);
    }
  }

  return { range, timeframe, start: start.toISOString(), end: end.toISOString() };
}

export function isLiveRange(value: string): value is LiveRange {
  return ['1D', '5D', '1M', '3M', 'YTD', '1Y', 'MAX'].includes(value);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}
