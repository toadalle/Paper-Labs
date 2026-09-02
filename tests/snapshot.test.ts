import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { MarketAsset, MarketBar, MarketQuote } from '../src/domain/types.js';
import type {
  HistoricalBarsRequest,
  LatestQuoteRequest,
  MarketDataCapabilities,
  MarketDataProvider
} from '../src/infrastructure/market-data/provider.js';
import { MarketDataSnapshotService } from '../src/infrastructure/market-data/snapshots.js';
import { Repository } from '../src/infrastructure/persistence/repository.js';
import { AuditService } from '../src/infrastructure/audit/audit-service.js';

class FakeProvider implements MarketDataProvider {
  readonly id = 'fake';
  bars: MarketBar[] = [];

  async capabilities(): Promise<MarketDataCapabilities> {
    return { checkedAt: new Date().toISOString(), configured: true, historical: { test: 'AVAILABLE' }, live: { test: 'AVAILABLE' }, assetClasses: ['US_EQUITY', 'CRYPTO'], notes: [] };
  }
  async historicalBars(_request: HistoricalBarsRequest): Promise<MarketBar[]> { return structuredClone(this.bars); }
  async latestQuote(request: LatestQuoteRequest): Promise<MarketQuote> {
    return { symbol: request.symbol, assetClass: request.assetClass ?? 'US_EQUITY', timestamp: new Date().toISOString(), bidPrice: 1, bidSize: 1, askPrice: 2, askSize: 1, provider: this.id, feed: request.feed };
  }
  async searchAssets(): Promise<MarketAsset[]> { return []; }
}

const request: HistoricalBarsRequest = {
  symbol: 'SPY', timeframe: '1Day', start: '2026-01-01T00:00:00.000Z', end: '2026-01-03T00:00:00.000Z', feed: 'test', adjustmentMode: 'split'
};

test('provider-side data revision creates a new snapshot, audits it, and supersedes old evidence without compromising it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-snapshot-'));
  const repo = new Repository(join(dir, 'state.sqlite'));
  const audit = new AuditService(repo);
  const provider = new FakeProvider();
  const service = new MarketDataSnapshotService(repo, provider, audit, join(dir, 'datasets'));
  try {
    provider.bars = [{ time: '2026-01-02T00:00:00.000Z', open: 100, high: 103, low: 99, close: 102, volume: 1_000 }];
    const first = await service.capture(request, 'corr_1');
    assert.equal(first.version, 1);
    assert.equal(await service.verify(first), true);

    provider.bars = [{ time: '2026-01-02T00:00:00.000Z', open: 100, high: 104, low: 99, close: 103, volume: 1_000 }];
    const second = await service.capture(request, 'corr_2');
    assert.equal(second.version, 2);
    assert.equal(second.supersedesSnapshotId, first.id);
    assert.equal(repo.getMarketDataSnapshot(first.id)?.status, 'SUPERSEDED');
    assert.equal(repo.getMarketDataSnapshot(second.id)?.status, 'VALID');
    assert.equal(repo.listAuditEvents().filter(event => event.eventType === 'MARKET_DATA_SNAPSHOT_CAPTURED').length, 2);
    assert.equal(repo.listAuditEvents().some(event => event.eventType === 'MARKET_DATA_SNAPSHOT_SUPERSEDED'), true);
    assert.equal(audit.verify().valid, true);
  } finally {
    repo.close(); rmSync(dir, { recursive: true, force: true });
  }
});
