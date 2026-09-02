import type { Experience } from '../../domain/types.js';

export function requireResearchValid(experiences: Experience[], purpose: string): Experience[] {
  const compromised = experiences.filter(experience => experience.researchValidity !== 'VALID');
  if (compromised.length) {
    throw new Error(`${purpose} cannot use compromised research evidence: ${compromised.map(item => item.id).join(', ')}.`);
  }
  return experiences;
}
