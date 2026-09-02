# Paper Lab — Iteration 1.3.9

**Model:** GPT-5.6 Sol  
**Version:** 1.3.9  
**Status:** implementation complete  
**Scope:** Notification toast acknowledgement + chronological history grouping

## RESULT

Implemented two Notification Manager refinements requested during 1.3 testing:

1. Opening Notification History now expires/dismisses the active transient toast surface because the user has explicitly opened the persistent notification surface.
2. Unfiltered Notification History is organized into collapsible, progressively coarser ISO chronology groups instead of one endless flat list.

No NotificationEvent history is deleted.

## FILES CHANGED

### Frontend
- `src/frontend/main.ts` — expires active/queued toast presentations when History opens; renders grouped unfiltered history; preserves group open/collapse state across application rerenders.
- `src/frontend/notifications/history.ts` — pure chronological grouping policy for day / ISO week / month / year history sections.
- `public/styles.css` — grouped-history section/summary styling.

### Tests
- `tests/notification-history.test.ts` — verifies progressive ISO grouping and row ordering.
- `tests/frontend-makeover.test.ts` — verifies History-open toast expiration and grouped rendering contract.

### Versioning
- `package.json`
- `package-lock.json`
- `src/domain/version.ts`

## TESTS

- TypeScript client/server/tests: PASS
- Automated tests: 65 / 65 PASS
- Production build: PASS

## SPEC SECTIONS

Aligned with the Notification Center design: NotificationEvent remains persistent user-facing history while toast cards are disposable presentation state.

## DEVIATIONS

None.

## RISKS

Low. Presentation/history organization only; no research state or audit semantics changed.

## CHANGELOG

### Added
- Chronological notification-history grouping helper.
- Collapsible ISO day/week/month/year sections.

### Modified
- Opening History acknowledges/removes transient toast cards.
- Filtered history remains flat; unfiltered history uses chronology sections.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED
- Notification history cannot be cleared/deleted by this behavior.
- Toast dismissal remains presentation state and does not alter AuditEvent history.
- Older chronology becomes progressively coarser to keep long-running Notification History usable.

### PENDING
- Entity Retire → Delete semantics remain intentionally unimplemented pending Claude/user design agreement.

## FOLLOW-UP

Continue 1.3.x polish/testing. No Claude review required for this iteration alone.
