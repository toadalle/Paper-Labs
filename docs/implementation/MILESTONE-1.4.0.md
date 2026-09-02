# Paper Lab — Milestone 1.4.0: Entity Lifecycle Removal

## Scope

1.4.0 introduces the user-approved two-stage Entity cleanup flow:

```text
Candidate / Permanent → Retire → Delete
```

Deletion removes a Retired Entity from the working population while always preserving an immutable Entity tombstone and all research/audit evidence.

## Frontend

- Entity Inspector exposes `Retire` before retirement and `Delete` afterward.
- Entity rows/Objects support right-click context actions.
- Keyboard context-menu access supports Context Menu key and `Shift+F10`.
- Inspector and context menu derive lifecycle action from one shared frontend rule.
- Retire and Delete use app-owned destructive confirmation modals.
- Successful Delete removes the Entity from Recent/Pinned and clears selected URL state.

## Backend

- `POST /api/entities/:id/retire`
- `DELETE /api/entities/:id`
- `EntityService.retire()` owns lifecycle transition and audit.
- `EntityService.deleteRetired()` owns tombstone creation, working-record removal, and audit atomically.
- `EntityTombstone` is immutable and always created.

## Persistence

- New object kind: `entity_tombstone`.
- Tombstones use the deleted Entity ID as their immutable identity anchor.
- No evidence records cascade-delete.

## Validation

Covered by automated tests for:

- retire-before-delete enforcement,
- always-tombstone behavior,
- tombstone immutability,
- research-evidence preservation,
- audit rollback,
- monotonic default naming,
- shared lifecycle UI action,
- right-click and keyboard context paths.
