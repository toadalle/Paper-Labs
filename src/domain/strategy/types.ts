import type { EntityTraits, MarketBar } from '../types.js';

export type StrategyDecision =
  | { type: 'HOLD' }
  | { type: 'TARGET_POSITION'; targetFraction: number };

export interface TraitDefinition {
  key: string;
  label: string;
  type: 'INTEGER' | 'NUMBER';
  min?: number;
  max?: number;
  step?: number;
  default: number;
}

export interface StrategyStepInput {
  symbol: string;
  observation: Record<string, MarketBar>;
  history: Record<string, readonly MarketBar[]>;
  traits: EntityTraits;
  currentTargetFraction: number;
}

export interface StrategyDecisionResult {
  decision: StrategyDecision;
  indicators: Record<string, number | null>;
}

export interface StrategyDefinition {
  strategyType: string;
  strategyVersion: number;
  displayName: string;
  traitDefinitions: readonly TraitDefinition[];
  validateTraits(traits: EntityTraits): EntityTraits;
  requiredWarmupBars(traits: EntityTraits): number;
  decide(input: StrategyStepInput): StrategyDecisionResult;
}
