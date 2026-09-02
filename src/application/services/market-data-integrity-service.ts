import { readFile } from 'node:fs/promises';
import { createId } from '../../domain/id.js';
import type { Logger } from '../../infrastructure/logging/logger.js';
import { sha256 } from '../../infrastructure/hash.js';
import type { Repository } from '../../infrastructure/persistence/repository.js';
import type { ResearchIntegrityService } from './research-integrity-service.js';

export interface MarketDataIntegrityCheckResult {
  snapshotId: string;
  valid: boolean;
  compromised: boolean;
  reason: string | null;
  expectedHash: string;
  actualHash: string | null;
  affectedExperienceIds: string[];
}

export interface MarketDataIntegritySweepResult {
  checkedAt: string;
  checked: number;
  valid: number;
  compromised: number;
  results: MarketDataIntegrityCheckResult[];
}

export class MarketDataIntegrityService {
  constructor(
    private readonly repository: Repository,
    private readonly researchIntegrity: ResearchIntegrityService,
    private readonly logger: Logger
  ) {}

  async verifySnapshot(snapshotId: string, correlationId = createId('operation')): Promise<MarketDataIntegrityCheckResult> {
    const snapshot = this.repository.getMarketDataSnapshot(snapshotId);
    if (!snapshot) throw new Error('MarketDataSnapshot not found.');

    let actualHash: string | null = null;
    let reason: string | null = null;

    try {
      const stored = await readFile(snapshot.artifactPath, 'utf8');
      actualHash = sha256(stored);
      if (actualHash !== snapshot.contentHash) {
        reason = `Stored artifact hash mismatch. Expected ${snapshot.contentHash}, received ${actualHash}.`;
      }
    } catch (error) {
      reason = `Stored artifact is unreadable: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (reason === null) {
      this.logger.debug({
        category: 'market-data',
        event: 'MARKET_DATA_INTEGRITY_CHECK_PASSED',
        message: `Market-data snapshot ${snapshot.id} passed artifact integrity verification.`,
        correlationId,
        snapshotId: snapshot.id,
        context: { status: snapshot.status, contentHash: snapshot.contentHash }
      });
      return {
        snapshotId: snapshot.id,
        valid: true,
        compromised: snapshot.status === 'COMPROMISED',
        reason: null,
        expectedHash: snapshot.contentHash,
        actualHash,
        affectedExperienceIds: []
      };
    }

    this.logger.error({
      category: 'market-data',
      event: 'MARKET_DATA_INTEGRITY_CHECK_FAILED',
      message: `Market-data snapshot ${snapshot.id} failed artifact integrity verification.`,
      correlationId,
      snapshotId: snapshot.id,
      context: { reason, status: snapshot.status, expectedHash: snapshot.contentHash, actualHash }
    });

    const result = this.researchIntegrity.compromiseSnapshot(snapshot.id, reason, correlationId);
    return {
      snapshotId: snapshot.id,
      valid: false,
      compromised: true,
      reason,
      expectedHash: snapshot.contentHash,
      actualHash,
      affectedExperienceIds: result.affectedExperienceIds
    };
  }

  async verifyAll(correlationId = createId('operation')): Promise<MarketDataIntegritySweepResult> {
    const results: MarketDataIntegrityCheckResult[] = [];
    for (const snapshot of this.repository.listMarketDataSnapshots()) {
      results.push(await this.verifySnapshot(snapshot.id, correlationId));
    }
    return {
      checkedAt: new Date().toISOString(),
      checked: results.length,
      valid: results.filter(result => result.valid).length,
      compromised: results.filter(result => result.compromised).length,
      results
    };
  }
}
