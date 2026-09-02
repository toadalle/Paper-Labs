# Paper Lab — Iteration 1.3.5

**Model:** GPT-5.6 Sol  
**Version:** 1.3.5  
**Status:** routine interaction correction  
**Baseline:** 1.3.4

## RESULT

Implemented two user-requested 1.3.x presentation corrections. Entity deletion/context-menu work is intentionally NOT implemented because destructive Entity removal changes domain/history semantics and has been escalated for design review.

## CHANGELOG

### Notifications

- MODIFIED `src/frontend/main.ts`
  - live toast presentation now coalesces by severity.
  - a new toast supersedes any visible or queued toast of the same severity.
  - distinct severities may remain visible simultaneously.
  - superseded notifications remain in Notification Center history and are marked dismissed as presentation state.

### Inspector actions

- MODIFIED `public/styles.css`
  - action grids now auto-fit as many buttons as can fit the available width.
  - long action labels wrap instead of breaking alignment.
  - buttons in the same grid row stretch to aligned heights.

### Tests

- MODIFIED `tests/frontend-makeover.test.ts`
  - added regression assertions for severity coalescing.
  - added regression assertions for responsive/wrapped Inspector action grids.

## TESTS

- TypeScript client/server/tests: PASS
- Automated tests: 57 / 57 PASS
- Build: PASS
- Runtime bootstrap 1.3.5: PASS

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- Notification Center still retains every persisted NotificationEvent; only transient toast presentation is coalesced.
- AuditEvent and NotificationEvent boundaries remain unchanged.

### PENDING NEW FEATURE DESIGN

- User requested right-click Entity context actions and an Inspector Delete action.
- No deletion route/repository mutation was added in 1.3.5.
- Proposed semantics are documented separately for Claude review before implementation.

## DEVIATIONS

None.

## RISKS

Entity deletion must not be implemented as unrestricted object removal because Entity IDs are referenced by Experience, MarketMemoryCell, PromotionDecision, child lineage, and Evolution history.
