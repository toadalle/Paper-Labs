import test from 'node:test';
import assert from 'node:assert/strict';
import { FULL_VIEWPORT, panViewport, renderMarketChart, singleHoverPoint, zoomViewport } from '../src/frontend/live/chart.js';
import type { LiveChartView } from '../src/frontend/types.js';

const chart: LiveChartView = {
  symbol: 'SPY', assetClass: 'US_EQUITY', provider: 'alpaca', feed: 'iex', range: '1D', timeframe: '1Min',
  requestedStart: '2026-08-31T10:00:00.000Z', requestedEnd: '2026-08-31T10:05:00.000Z',
  actualStart: '2026-08-31T10:00:00.000Z', actualEnd: '2026-08-31T10:04:00.000Z',
  bars: Array.from({ length: 5 }, (_, index) => ({
    time: `2026-08-31T10:0${index}:00.000Z`, open: 100 + index, high: 102 + index, low: 99 + index,
    close: 101 + index, volume: 1000 + index
  }))
};

test('chart viewport zooms around cursor and pans without leaving loaded range', () => {
  const zoomed = zoomViewport(FULL_VIEWPORT, 0.5, 0.5);
  assert.ok(zoomed.start > 0 && zoomed.end < 1);
  const panned = panViewport(zoomed, 0.2);
  assert.ok(panned.start >= 0 && panned.end <= 1);
  assert.equal(Number((panned.end - panned.start).toFixed(5)), Number((zoomed.end - zoomed.start).toFixed(5)));
});

test('single chart hover snaps to a real bar close and returns inspector details', () => {
  const point = singleHoverPoint(chart, 'CANDLES_VOLUME', FULL_VIEWPORT, 0.5);
  assert.ok(point);
  assert.equal(point.details.kind, 'SINGLE');
  assert.notEqual(point.details.close, undefined);
  assert.ok(point.xRatio > 0 && point.xRatio < 1);
  assert.ok(point.yRatio > 0 && point.yRatio < 1);
});


test('intraday chart axis uses compact time labels rather than repeated full dates', () => {
  const html = renderMarketChart(chart, 'LINE', false, [], false, null, FULL_VIEWPORT);
  assert.match(html, /data-chart-time-label/);
  assert.doesNotMatch(html, /Aug 31,/);
});
