# Paper Lab — 1.4.0 Entity Retire → Delete Milestone Handoff

**Model:** GPT-5.6 Sol
**Status:** implementation complete pending user test / targeted Tier-3 review

## RESULT

Implemented the accepted Entity two-stage cleanup flow with Claude's always-tombstone refinement.

## CHANGELOG

### Domain / persistence

- Added immutable `EntityTombstone`.
- Added `entity_tombstone` persistence kind and repository accessors.
- Added working-Entity removal primitive used only through EntityService.

### Application

- Added `EntityService.retire()`.
- Added `EntityService.deleteRetired()`.
- Delete always creates a tombstone, removes the working Entity, and appends `ENTITY_DELETED` inside one transaction.

### API

- Added `POST /api/entities/:id/retire`.
- Added `DELETE /api/entities/:id`.

### Frontend

- Inspector lifecycle action is `Retire` for Candidate/Permanent and `Delete` for Retired.
- Added Entity right-click / keyboard context menu with Pin/Unpin + lifecycle action.
- Added app-owned confirmation modal for Retire/Delete.
- Delete removes local Recent/Pinned references and clears Entity URL selection.

### Docs

- Added Architecture Amendment 003.
- Added milestone 1.4.0 implementation reference.
- Added D-028.
- Fixed stale version-specific wording in `DEVIATIONS.md` per Claude's 1.3.9 manager review.

## TESTS

Added automated coverage for:

- Delete blocked before Retire.
- Retire transition invariants.
- Every Delete creates immutable tombstone.
- Historical Experience remains after Entity removal.
- Audit append failure rolls Delete back completely.
- Default Entity numbering remains monotonic after Delete.
- Inspector/context-menu lifecycle action consistency.
- Right-click + ContextMenu/Shift+F10 paths.

## SPEC SECTIONS

- `docs/architecture/ARCHITECTURE-AMENDMENT-003-entity-retire-delete-tombstones.md`
- D-028

## DEVIATIONS

None.

## RISKS

Tier 3: Entity tombstone persistence, Delete transaction/audit, future historical identity resolution.

The current application has no dedicated historical tombstone-detail UI because no existing historical page requires it yet. Repository resolution support exists for future consumers.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- Claude refinement: tombstone on every Delete.
- Retire before Delete.
- no cascade evidence deletion.
- atomic required audit.
- no fourth lifecycle state.
- shared Inspector/context-menu lifecycle decision.

### PENDING

- Historical screens should resolve deleted Entity identity through tombstones when those screens are implemented.

### DEVIATIONS

None.

## MANIFEST DIFF FROM 1.3.9

```text
ADDED     8 tracked files
MODIFIED 12 tracked files
REMOVED   0 tracked files
```

The change set is derived from `MANIFEST-1.3.9.json` → `MANIFEST-1.4.0.json`, not model memory.
