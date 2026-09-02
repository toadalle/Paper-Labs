# Paper Lab — Iteration 1.3.8

**Model:** GPT-5.6 Sol  
**Version:** 1.3.8  
**Status:** implementation complete  
**Scope:** Live action consistency + Notification panel dismissal

## RESULT

Implemented two UX consistency corrections requested during 1.3 testing:

1. `Remove from watchlist` is available from both the Live symbol context menu and Inspector Actions, and both entry points use the same `removeLiveObject()` handler.
2. The right-side Notification History panel now closes when the user clicks outside it, while retaining bell-toggle, close-button, and Escape behavior.

No domain or research semantics changed.

## FILES CHANGED

### Frontend
- `src/frontend/main.ts` — adds outside-click dismissal for Notification History and wires Inspector watchlist removal to the existing shared action.
- `src/frontend/pages/live.ts` — adds `Remove from watchlist` to Live Inspector Actions.

### Tests
- `tests/frontend-makeover.test.ts` — verifies both Live removal entry points and Notification panel outside-click dismissal.

### Versioning
- `package.json`
- `package-lock.json`
- `src/domain/version.ts`

## TESTS

- TypeScript client/server/tests: PASS
- Automated tests: 62 / 62 PASS
- Production build: PASS

## SPEC SECTIONS

Aligned with the existing frontend principle that the same domain/view action exposed from multiple UI surfaces must share one implementation path.

## DEVIATIONS

None.

## RISKS

Low. UI-only behavior; no persistence or research-history changes.

## CHANGELOG

### Modified
- Live Inspector action surface now mirrors the symbol context menu for watchlist removal.
- Notification History panel uses standard outside-click dismissal.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED
- `Remove from watchlist` remains view-preference state only.
- Notification History remains a right-side panel, not a modal or floating flyout.

### PENDING
- Entity Retire → Delete semantics remain intentionally unimplemented pending Claude/user design agreement.

## FOLLOW-UP

Continue 1.3.x polish/testing. No Claude review required for this iteration alone.
