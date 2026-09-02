import test from 'node:test';
import assert from 'node:assert/strict';
import { isLiveRange, resolveLiveChartQuery } from '../src/application/live/chart-query.js';

test('live chart range policy resolves human ranges centrally', () => {
  const now = new Date('2026-08-31T12:00:00.000Z');
  assert.equal(resolveLiveChartQuery('1D', 'US_EQUITY', now).timeframe, '5Min');
  assert.equal(resolveLiveChartQuery('1M', 'US_EQUITY', now).timeframe, '1Hour');
  assert.equal(resolveLiveChartQuery('1Y', 'US_EQUITY', now).timeframe, '1Day');
  assert.equal(resolveLiveChartQuery('MAX', 'CRYPTO', now).start, '2021-01-01T00:00:00.000Z');
});

test('only supported chart ranges are accepted', () => {
  assert.equal(isLiveRange('YTD'), true);
  assert.equal(isLiveRange('2Y'), false);
});
