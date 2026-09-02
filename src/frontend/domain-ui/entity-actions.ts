import type { Entity } from '../../domain/types.js';

export type EntityLifecycleActionId = 'RETIRE' | 'DELETE';

export interface EntityLifecycleAction {
  id: EntityLifecycleActionId;
  label: string;
  destructive: true;
}

export function lifecycleActionForEntity(entity: Entity): EntityLifecycleAction {
  return entity.lifecycleState === 'RETIRED'
    ? { id: 'DELETE', label: 'Delete', destructive: true }
    : { id: 'RETIRE', label: 'Retire', destructive: true };
}
