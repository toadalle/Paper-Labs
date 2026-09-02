import type { Entity } from '../../domain/types.js';
import { escapeHtml } from '../shared/escape.js';

export function lifecycleChip(entity: Entity): string {
  return `<span class="status-chip">${escapeHtml(entity.lifecycleState)}</span>`;
}

export function candidateStateLabel(entity: Entity): string {
  return entity.candidateStatus ?? '—';
}
