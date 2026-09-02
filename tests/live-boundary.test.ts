import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Live display routes read directly through MarketDataProvider and do not capture MarketDataSnapshots', () => {
  const source = readFileSync('src/server/routes.ts', 'utf8');
  const start = source.indexOf("url.pathname === '/api/market/assets'");
  const end = source.indexOf("url.pathname === '/api/entities'");
  assert.ok(start >= 0 && end > start);
  const liveRoutes = source.slice(start, end);
  assert.match(liveRoutes, /provider\.searchAssets/);
  assert.match(liveRoutes, /provider\.latestQuote/);
  assert.match(liveRoutes, /provider\.historicalBars/);
  assert.doesNotMatch(liveRoutes, /MarketDataSnapshot|\.capture\(/);
});

test('Compare% contract remains line-only in the Live renderer', () => {
  const pageSource = readFileSync('src/frontend/pages/live.ts', 'utf8');
  const chartSource = readFileSync('src/frontend/live/chart.ts', 'utf8');
  assert.match(pageSource, /Compare% uses line rendering/);
  assert.match(chartSource, /if \(compareEnabled\) return renderCompareChart/);
  assert.doesNotMatch(chartSource, /compareEnabled.*candleMarks/);
});
