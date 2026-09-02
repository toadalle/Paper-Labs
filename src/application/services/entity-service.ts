import { createCandidate } from '../../domain/factories.js';
import { assertEntity } from '../../domain/invariants.js';
import type { Entity, EntityTombstone, EntityTraits } from '../../domain/types.js';
import { strategyRegistry } from '../../domain/strategy/registry.js';
import { canonicalJson, sha256 } from '../../infrastructure/hash.js';
import type { AuditService } from '../../infrastructure/audit/audit-service.js';
import type { Repository } from '../../infrastructure/persistence/repository.js';

export class EntityService {
  constructor(
    private readonly repository: Repository,
    private readonly audit: AuditService
  ) {}

  quickCreate(correlationId: string): Entity {
    return this.repository.withTransaction(() => {
      const number = this.repository.reserveCounter('entity_default_name', this.repository.count('entity'));
      const entity = createCandidate({ name: `New Entity ${number}` });
      this.repository.saveEntity(entity);
      this.audit.record({
        eventType: 'ENTITY_CREATED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Entity', id: entity.id },
        correlationId,
        summary: `Created ${entity.name}.`,
        details: { lifecycleState: entity.lifecycleState, defaultSequence: number },
        beforeHash: null,
        afterHash: sha256(canonicalJson(entity))
      });
      return entity;
    });
  }

  createImportedDraft(input: { name?: string; family?: string | null; strategyType?: string | null; strategyVersion?: number | null; traits?: EntityTraits }, correlationId: string): Entity {
    return this.repository.withTransaction(() => {
      const number = this.repository.reserveCounter('entity_default_name', this.repository.count('entity'));
      let entity = createCandidate({ name: input.name?.trim() || `New Entity ${number}`, family: normalizeFamily(input.family ?? null) });
      if (input.strategyType) {
        if (input.strategyVersion == null) throw new Error('Portable Entity create requires strategy version when strategy type is supplied.');
        const definition = strategyRegistry.get(input.strategyType, input.strategyVersion);
        const defaults = Object.fromEntries(definition.traitDefinitions.map(item => [item.key, item.default])) as EntityTraits;
        const validated = strategyRegistry.validate(input.strategyType, input.strategyVersion, { ...defaults, ...(input.traits ?? {}) });
        entity = assertEntity({
          ...entity,
          strategyType: validated.definition.strategyType,
          strategyVersion: validated.definition.strategyVersion,
          traits: structuredClone(validated.traits)
        });
      } else if (input.traits && Object.keys(input.traits).length) {
        throw new Error('Portable Entity create cannot supply traits without strategy type and version.');
      }
      this.repository.saveEntity(entity);
      this.audit.record({
        eventType: 'ENTITY_CREATED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Entity', id: entity.id },
        correlationId,
        summary: `Imported draft Entity ${entity.name}.`,
        details: { lifecycleState: entity.lifecycleState, configurationStatus: entity.configurationStatus, defaultSequence: number, source: 'IMPORT' },
        beforeHash: null,
        afterHash: sha256(canonicalJson(entity))
      });
      return entity;
    });
  }

  createVariantDraft(parentId: string, input: { strategyType: string; strategyVersion: number; traits: EntityTraits }, correlationId: string): Entity {
    return this.repository.withTransaction(() => {
      const parent = this.repository.getEntity(parentId);
      if (!parent) throw new Error('Variant parent Entity not found.');
      if (parent.configurationStatus !== 'READY') throw new Error('Import variants require a READY parent Entity.');
      const validated = strategyRegistry.validate(input.strategyType, input.strategyVersion, input.traits);
      const number = this.repository.reserveCounter('entity_default_name', this.repository.count('entity'));
      const entity = assertEntity({
        ...createCandidate({
          name: `New Entity ${number}`,
          family: parent.family,
          parentEntityId: parent.id,
          mutationOperator: 'VARIANT'
        }),
        strategyType: validated.definition.strategyType,
        strategyVersion: validated.definition.strategyVersion,
        traits: structuredClone(validated.traits)
      });
      this.repository.saveEntity(entity);
      this.audit.record({
        eventType: 'ENTITY_VARIANT_CREATED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Entity', id: entity.id },
        correlationId,
        causationId: parent.id,
        summary: `Created draft Variant ${entity.name} from ${parent.name}.`,
        details: { parentEntityId: parent.id, strategyType: entity.strategyType, strategyVersion: entity.strategyVersion, source: 'IMPORT' },
        beforeHash: sha256(canonicalJson(parent)),
        afterHash: sha256(canonicalJson(entity))
      });
      return entity;
    });
  }

  updateMetadata(id: string, input: { name?: string; family?: string | null }, correlationId: string): Entity {
    return this.repository.withTransaction(() => {
      const current = this.repository.getEntity(id);
      if (!current) throw new Error('Entity not found.');
      const next = assertEntity({
        ...current,
        name: input.name === undefined ? current.name : input.name.trim(),
        family: input.family === undefined ? current.family : normalizeFamily(input.family)
      });
      const beforeHash = sha256(canonicalJson(current));
      this.repository.saveEntity(next);
      const afterHash = sha256(canonicalJson(next));
      if (beforeHash !== afterHash) {
        this.audit.record({
          eventType: 'ENTITY_METADATA_UPDATED',
          actor: { type: 'USER', id: null },
          subject: { type: 'Entity', id },
          correlationId,
          summary: `Updated mutable metadata for ${next.name}.`,
          details: {
            changedFields: [
              ...(current.name !== next.name ? ['name'] : []),
              ...(current.family !== next.family ? ['family'] : [])
            ]
          },
          beforeHash,
          afterHash
        });
      }
      return next;
    });
  }

  configureDraft(id: string, input: { strategyType: string; strategyVersion?: number | null; traits: EntityTraits }, correlationId: string): Entity {
    return this.repository.withTransaction(() => {
      const current = this.repository.getEntity(id);
      if (!current) throw new Error('Entity not found.');
      if (current.lifecycleState !== 'CANDIDATE') throw new Error('Only Candidate entities may be configured.');
      if (current.configurationStatus !== 'DRAFT') throw new Error('READY Entity birth configuration is immutable.');
      const validated = strategyRegistry.validate(input.strategyType, input.strategyVersion, input.traits);
      const next = assertEntity({
        ...current,
        strategyType: validated.definition.strategyType,
        strategyVersion: validated.definition.strategyVersion,
        traits: structuredClone(validated.traits),
        traitHash: null
      });
      const beforeHash = sha256(canonicalJson(current));
      this.repository.saveEntity(next);
      this.audit.record({
        eventType: 'ENTITY_DRAFT_CONFIGURATION_UPDATED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Entity', id },
        correlationId,
        summary: `Updated draft strategy configuration for ${next.name}.`,
        details: { strategyType: next.strategyType, strategyVersion: next.strategyVersion },
        beforeHash,
        afterHash: sha256(canonicalJson(next))
      });
      return next;
    });
  }

  finalizeConfiguration(id: string, input: { strategyType?: string; strategyVersion?: number | null; traits?: EntityTraits }, correlationId: string): Entity {
    return this.repository.withTransaction(() => {
      const current = this.repository.getEntity(id);
      if (!current) throw new Error('Entity not found.');
      if (current.lifecycleState !== 'CANDIDATE') throw new Error('Only Candidate entities may finalize configuration.');
      if (current.configurationStatus !== 'DRAFT') throw new Error('Entity configuration is already finalized.');
      const strategyType = input.strategyType ?? current.strategyType;
      const strategyVersion = input.strategyVersion ?? current.strategyVersion;
      const traits = input.traits ?? current.traits;
      if (!strategyType) throw new Error('Strategy type is required.');
      const validated = strategyRegistry.validate(strategyType, strategyVersion, traits);
      const normalizedTraits = structuredClone(validated.traits);
      const traitHash = sha256(canonicalJson({
        strategyType: validated.definition.strategyType,
        strategyVersion: validated.definition.strategyVersion,
        traits: normalizedTraits
      }));
      const next = assertEntity({
        ...current,
        configurationStatus: 'READY' as const,
        strategyType: validated.definition.strategyType,
        strategyVersion: validated.definition.strategyVersion,
        traits: normalizedTraits,
        traitHash
      });
      const beforeHash = sha256(canonicalJson(current));
      this.repository.saveEntity(next);
      this.audit.record({
        eventType: 'ENTITY_CONFIGURATION_FINALIZED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Entity', id },
        correlationId,
        summary: `Finalized immutable birth configuration for ${next.name}.`,
        details: { strategyType: next.strategyType, strategyVersion: next.strategyVersion, traitHash },
        beforeHash,
        afterHash: sha256(canonicalJson(next))
      });
      return next;
    });
  }

  retire(id: string, correlationId: string): Entity {
    return this.repository.withTransaction(() => {
      const current = this.repository.getEntity(id);
      if (!current) throw new Error('Entity not found.');
      if (current.lifecycleState === 'RETIRED') throw new Error('Entity is already retired.');

      const next = assertEntity({
        ...current,
        lifecycleState: 'RETIRED' as const,
        candidateStatus: null,
        evolutionRunId: null,
        retiredAt: new Date().toISOString()
      });
      const beforeHash = sha256(canonicalJson(current));
      this.repository.saveEntity(next);
      this.audit.record({
        eventType: 'ENTITY_RETIRED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Entity', id },
        correlationId,
        summary: `Retired ${next.name}.`,
        details: {
          previousLifecycleState: current.lifecycleState,
          retiredAt: next.retiredAt
        },
        beforeHash,
        afterHash: sha256(canonicalJson(next))
      });
      return next;
    });
  }

  deleteRetired(id: string, correlationId: string): EntityTombstone {
    return this.repository.withTransaction(() => {
      const current = this.repository.getEntity(id);
      if (!current) throw new Error('Entity not found.');
      if (current.lifecycleState !== 'RETIRED') throw new Error('Entity must be retired before deletion.');

      const tombstone: EntityTombstone = {
        id: current.id,
        entityId: current.id,
        deletedAt: new Date().toISOString(),
        lastKnownName: current.name,
        family: current.family,
        lifecycleAtDeletion: 'RETIRED',
        birthEvolutionRunId: current.birthEvolutionRunId,
        parentEntityId: current.parentEntityId,
        mutationOperator: current.mutationOperator,
        originalCreatedAt: current.createdAt
      };

      const beforeHash = sha256(canonicalJson(current));
      this.repository.saveEntityTombstone(tombstone);
      this.repository.deleteEntity(current.id);
      this.audit.record({
        eventType: 'ENTITY_DELETED',
        actor: { type: 'USER', id: null },
        subject: { type: 'Entity', id: current.id },
        correlationId,
        summary: `Deleted retired Entity ${current.name} from the working population.`,
        details: {
          lastKnownName: current.name,
          lifecycleAtDeletion: current.lifecycleState,
          tombstoneCreated: true,
          tombstoneId: tombstone.id
        },
        beforeHash,
        afterHash: sha256(canonicalJson(tombstone))
      });
      return tombstone;
    });
  }
}

function normalizeFamily(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}
