import type { EntityTraits } from '../types.js';
import { simpleMovingAverage } from './indicators.js';
import type { StrategyDefinition, StrategyDecisionResult, StrategyStepInput } from './types.js';

export const MOVING_AVERAGE_CROSS_TYPE = 'MOVING_AVERAGE_CROSS';
export const MOVING_AVERAGE_CROSS_VERSION = 1;

export interface MovingAverageCrossTraits {
  fast_window: number;
  slow_window: number;
  target_exposure: number;
}

function numberTrait(traits: EntityTraits, key: keyof MovingAverageCrossTraits): number {
  const value = traits[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
  return value;
}

export const movingAverageCrossStrategy: StrategyDefinition = {
  strategyType: MOVING_AVERAGE_CROSS_TYPE,
  strategyVersion: MOVING_AVERAGE_CROSS_VERSION,
  displayName: 'Moving Average Cross',
  traitDefinitions: [
    { key: 'fast_window', label: 'Fast Window', type: 'INTEGER', min: 1, max: 100, step: 1, default: 10 },
    { key: 'slow_window', label: 'Slow Window', type: 'INTEGER', min: 2, max: 200, step: 1, default: 30 },
    { key: 'target_exposure', label: 'Target Exposure', type: 'NUMBER', min: 0, max: 1, step: 0.05, default: 1 }
  ],
  validateTraits(input: EntityTraits): EntityTraits {
    const fast = numberTrait(input, 'fast_window');
    const slow = numberTrait(input, 'slow_window');
    const target = numberTrait(input, 'target_exposure');
    if (!Number.isInteger(fast) || fast < 1 || fast > 100) throw new Error('fast_window must be an integer from 1 to 100.');
    if (!Number.isInteger(slow) || slow < 2 || slow > 200) throw new Error('slow_window must be an integer from 2 to 200.');
    if (fast >= slow) throw new Error('fast_window must be smaller than slow_window.');
    if (target < 0 || target > 1) throw new Error('target_exposure must be between 0 and 1.');
    return { fast_window: fast, slow_window: slow, target_exposure: target };
  },
  requiredWarmupBars(traits: EntityTraits): number {
    const validated = this.validateTraits(traits);
    return Number(validated.slow_window) - 1;
  },
  decide(input: StrategyStepInput): StrategyDecisionResult {
    const traits = this.validateTraits(input.traits);
    const history = input.history[input.symbol] ?? [];
    const fastMa = simpleMovingAverage(history, Number(traits.fast_window));
    const slowMa = simpleMovingAverage(history, Number(traits.slow_window));
    if (fastMa === null || slowMa === null) throw new Error('Moving Average Cross received insufficient bounded history.');
    return {
      decision: { type: 'TARGET_POSITION', targetFraction: fastMa > slowMa ? Number(traits.target_exposure) : 0 },
      indicators: { fast_ma: fastMa, slow_ma: slowMa }
    };
  }
};
