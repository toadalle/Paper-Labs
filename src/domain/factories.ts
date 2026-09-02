import { createId } from './id.js';
import { assertEntity, assertEvolutionPolicy } from './invariants.js';
import type { Entity, EntityTraits, EvolutionPolicy } from './types.js';

export function createCandidate(input: {
  name: string;
  traits?: EntityTraits;
  family?: string | null;
  evolutionRunId?: string | null;
  parentEntityId?: string | null;
  birthEvolutionRunId?: string | null;
  mutationOperator?: 'VARIANT' | 'MUTATION' | null;
}): Entity {
  const now = new Date().toISOString();
  return assertEntity({
    id: createId('entity'),
    name: input.name.trim(),
    family: input.family ?? null,
    lifecycleState: 'CANDIDATE',
    candidateStatus: 'ACTIVE',
    evolutionRunId: input.evolutionRunId ?? null,
    birthEvolutionRunId: input.birthEvolutionRunId ?? input.evolutionRunId ?? null,
    parentEntityId: input.parentEntityId ?? null,
    mutationOperator: input.mutationOperator ?? null,
    configurationStatus: 'DRAFT',
    strategyType: null,
    strategyVersion: null,
    traits: structuredClone(input.traits ?? {}),
    traitHash: null,
    createdAt: now,
    retiredAt: null
  });
}

export function defaultEvolutionPolicy(maxExperiences: number): EvolutionPolicy {
  return assertEvolutionPolicy({
    id: createId('evolution_policy'),
    version: 1,
    maxActivePopulation: 64,
    minViablePopulation: 8,
    maxExperiences,
    minSurvivalAge: 4,
    survivalRewardFloor: 0,
    minBreedingAge: 4,
    breedingTopPercentile: 0.25,
    maxChildrenPerParentPerCycle: 1,
    maxLifetimeOffspring: 2,
    variantProbability: 0.75,
    mutationProbability: 0.25,
    rewardLambda: 1,
    createdAt: new Date().toISOString()
  });
}
