export interface SurvivalInput {
  age: number;
  recentDiscoveryRewards: number[];
  hardGatePassed: boolean;
  maxExperiences: number;
  minSurvivalAge: number;
  survivalRewardFloor: number;
}

export type SurvivalDecision =
  | { result: 'DEAD'; reason: 'HARD_GATE' | 'LIFESPAN' | 'SURVIVAL_SCORE'; score: number | null }
  | { result: 'GRACE'; reason: 'IMMATURE'; score: null }
  | { result: 'SURVIVES'; reason: 'SCORE'; score: number };

export function median(values: number[]): number {
  if (!values.length) throw new Error('Median requires at least one value.');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function decideSurvival(input: SurvivalInput): SurvivalDecision {
  if (!input.hardGatePassed) return { result: 'DEAD', reason: 'HARD_GATE', score: null };
  if (input.age >= input.maxExperiences) return { result: 'DEAD', reason: 'LIFESPAN', score: null };
  if (input.age < input.minSurvivalAge) return { result: 'GRACE', reason: 'IMMATURE', score: null };

  const window = input.recentDiscoveryRewards.slice(-Math.min(input.age, 4));
  if (!window.length) return { result: 'DEAD', reason: 'SURVIVAL_SCORE', score: null };
  const score = median(window);
  if (score <= input.survivalRewardFloor) return { result: 'DEAD', reason: 'SURVIVAL_SCORE', score };
  return { result: 'SURVIVES', reason: 'SCORE', score };
}
