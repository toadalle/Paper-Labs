import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createId } from '../../domain/id.js';
import { assertMarketBars, assertMarketDataSnapshot } from '../../domain/invariants.js';
import { DOMAIN_SCHEMA_VERSION } from '../../domain/version.js';
import type { MarketBar, MarketDataSnapshot } from '../../domain/types.js';
import { canonicalJson, sha256 } from '../hash.js';
import type { AuditService } from '../audit/audit-service.js';
import type { HistoricalBarsRequest, MarketDataProvider } from './provider.js';
import type { Repository } from '../persistence/repository.js';

export class MarketDataSnapshotService {
  constructor(
    private readonly repository: Repository,
    private readonly provider: MarketDataProvider,
    private readonly audit: AuditService,
    private readonly root = 'data/datasets'
  ) {}

  async capture(request: HistoricalBarsRequest, correlationId = createId('operation')): Promise<MarketDataSnapshot> {
    const bars = assertMarketBars(
      await this.provider.historicalBars(request).then(items => items.map(item => structuredClone(item)))
    );
    const canonical = canonicalJson(bars);
    const hash = sha256(canonical);
    await mkdir(this.root, { recursive: true });

    const identity = (snapshot: MarketDataSnapshot) =>
      snapshot.provider === this.provider.id &&
      snapshot.feed === request.feed &&
      snapshot.symbolUniverse.length === 1 &&
      snapshot.symbolUniverse[0] === request.symbol.toUpperCase() &&
      snapshot.timeframe === request.timeframe &&
      snapshot.requestedStart === request.start &&
      snapshot.requestedEnd === request.end &&
      snapshot.adjustmentMode === request.adjustmentMode;

    const snapshots = this.repository.listMarketDataSnapshots().filter(identity);
    const exact = snapshots.find(snapshot => snapshot.contentHash === hash);
    if (exact) return exact;

    const previous = snapshots.sort((a, b) => b.version - a.version)[0] ?? null;
    const id = createId('snapshot');
    const artifactPath = join(this.root, `${id}.json`).replaceAll('\\', '/');
    const snapshot = assertMarketDataSnapshot({
      id,
      version: (previous?.version ?? 0) + 1,
      provider: this.provider.id,
      feed: request.feed,
      symbolUniverse: [request.symbol.toUpperCase()],
      timeframe: request.timeframe,
      requestedStart: request.start,
      requestedEnd: request.end,
      actualStart: bars[0]?.time ?? null,
      actualEnd: bars.at(-1)?.time ?? null,
      adjustmentMode: request.adjustmentMode,
      coverageMetadata: {
        eventCount: bars.length,
        empty: bars.length === 0
      },
      providerMetadata: {},
      fetchedAt: new Date().toISOString(),
      contentHash: hash,
      schemaVersion: DOMAIN_SCHEMA_VERSION,
      status: 'VALID',
      supersedesSnapshotId: previous?.id ?? null,
      artifactPath
    });

    await writeFile(artifactPath, canonical);
    try {
      this.repository.withTransaction(() => {
        this.repository.saveMarketDataSnapshot(snapshot);
        this.audit.record({
          eventType: 'MARKET_DATA_SNAPSHOT_CAPTURED',
          actor: { type: 'SYSTEM', id: null },
          subject: { type: 'MarketDataSnapshot', id: snapshot.id, version: snapshot.version },
          correlationId,
          summary: `Captured ${request.symbol.toUpperCase()} ${request.timeframe} market-data snapshot.`,
          details: { provider: snapshot.provider, feed: snapshot.feed, contentHash: snapshot.contentHash },
          beforeHash: null,
          afterHash: sha256(canonicalJson(snapshot))
        });
        if (previous) {
          const beforeHash = sha256(canonicalJson(previous));
          const superseded = this.repository.transitionMarketDataSnapshotStatus(previous.id, 'SUPERSEDED');
          this.audit.record({
            eventType: 'MARKET_DATA_SNAPSHOT_SUPERSEDED',
            actor: { type: 'SYSTEM', id: null },
            subject: { type: 'MarketDataSnapshot', id: previous.id, version: previous.version },
            correlationId,
            causationId: snapshot.id,
            summary: 'Older market-data snapshot superseded by a provider revision.',
            details: { replacementSnapshotId: snapshot.id },
            beforeHash,
            afterHash: sha256(canonicalJson(superseded))
          });
        }
      });
      return snapshot;
    } catch (error) {
      await rm(artifactPath, { force: true });
      throw error;
    }
  }

  async loadBars(snapshot: MarketDataSnapshot): Promise<MarketBar[]> {
    const stored = await readFile(snapshot.artifactPath, 'utf8');
    if (sha256(stored) !== snapshot.contentHash) throw new Error('MarketDataSnapshot artifact hash mismatch.');
    const parsed = JSON.parse(stored) as MarketBar[];
    return assertMarketBars(parsed.map(bar => structuredClone(bar)));
  }

  async verify(snapshot: MarketDataSnapshot): Promise<boolean> {
    const stored = await readFile(snapshot.artifactPath, 'utf8');
    return sha256(stored) === snapshot.contentHash;
  }
}
