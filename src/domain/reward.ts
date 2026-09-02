export interface RewardInput {
  excessReturn: number;
  maxDrawdown: number;
  lambda: number;
}

export function computeReward(input: RewardInput): number {
  if (![input.excessReturn, input.maxDrawdown, input.lambda].every(Number.isFinite)) {
    throw new Error('Reward input must be finite.');
  }
  if (input.maxDrawdown < 0) throw new Error('maxDrawdown must be non-negative.');
  if (input.lambda < 0) throw new Error('lambda must be non-negative.');
  return input.excessReturn - input.lambda * input.maxDrawdown;
}
