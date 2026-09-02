import { canonicalJson, sha256 } from '../../infrastructure/hash.js';
import type { AuditService } from '../../infrastructure/audit/audit-service.js';
import type { Repository } from '../../infrastructure/persistence/repository.js';

export class ResearchIntegrityService {
  constructor(
    private readonly repository: Repository,
    private readonly audit: AuditService
  ) {}

  compromiseSnapshot(snapshotId: string, reason: string, correlationId: string): { affectedExperienceIds: string[] } {
    return this.repository.withTransaction(() => {
      const before = this.repository.getMarketDataSnapshot(snapshotId);
      if (!before) throw new Error('MarketDataSnapshot not found.');
      if (before.status === 'COMPROMISED') {
        return {
          affectedExperienceIds: this.repository
            .listExperiencesBySnapshot(snapshotId)
            .filter(experience => experience.researchValidity === 'COMPROMISED_SOURCE')
            .map(experience => experience.id)
        };
      }
      const after = this.repository.transitionMarketDataSnapshotStatus(snapshotId, 'COMPROMISED');
      this.audit.record({
        eventType: 'MARKET_DATA_SNAPSHOT_COMPROMISED',
        actor: { type: 'SYSTEM', id: null },
        subject: { type: 'MarketDataSnapshot', id: snapshotId, version: after.version },
        correlationId,
        summary: 'Market-data snapshot marked compromised.',
        details: { reason },
        beforeHash: sha256(canonicalJson(before)),
        afterHash: sha256(canonicalJson(after))
      });

      const affectedExperienceIds: string[] = [];
      for (const experience of this.repository.listExperiencesBySnapshot(snapshotId)) {
        if (experience.researchValidity === 'COMPROMISED_SOURCE') continue;
        const beforeHash = sha256(canonicalJson(experience));
        const invalidated = this.repository.transitionExperienceResearchValidity(experience.id, 'COMPROMISED_SOURCE');
        affectedExperienceIds.push(experience.id);
        this.audit.record({
          eventType: 'EXPERIENCE_RESEARCH_VALIDITY_COMPROMISED',
          actor: { type: 'SYSTEM', id: null },
          subject: { type: 'Experience', id: experience.id },
          correlationId,
          causationId: snapshotId,
          summary: 'Experience excluded from trustworthy research claims because a source snapshot is compromised.',
          details: { snapshotId, reason },
          beforeHash,
          afterHash: sha256(canonicalJson(invalidated))
        });
      }

      return { affectedExperienceIds };
    });
  }
}
