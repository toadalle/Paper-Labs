import type { EntityTraits } from '../types.js';
import { movingAverageCrossStrategy } from './moving-average-cross.js';
import type { StrategyDefinition } from './types.js';

const definitions: readonly StrategyDefinition[] = [movingAverageCrossStrategy];

export class StrategyRegistry {
  list(): readonly StrategyDefinition[] { return definitions; }

  get(strategyType: string, strategyVersion?: number | null): StrategyDefinition {
    const candidates = definitions.filter(item => item.strategyType === strategyType);
    if (!candidates.length) throw new Error(`Unknown strategy type: ${strategyType}`);
    if (strategyVersion == null) return [...candidates].sort((a, b) => b.strategyVersion - a.strategyVersion)[0]!;
    const match = candidates.find(item => item.strategyVersion === strategyVersion);
    if (!match) throw new Error(`Unknown strategy version: ${strategyType} v${strategyVersion}`);
    return match;
  }

  validate(strategyType: string, strategyVersion: number | null | undefined, traits: EntityTraits): { definition: StrategyDefinition; traits: EntityTraits } {
    const definition = this.get(strategyType, strategyVersion);
    return { definition, traits: definition.validateTraits(traits) };
  }
}

export const strategyRegistry = new StrategyRegistry();
