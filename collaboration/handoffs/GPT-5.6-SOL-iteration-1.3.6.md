# Paper Lab — Iteration 1.3.6

**Model:** GPT-5.6 Sol  
**Version:** 1.3.6  
**Status:** implementation complete; user test requested

## RESULT

Implemented the user-authorized frontend changes while keeping Entity deletion out of code pending Claude review.

## CHANGELOG

### Entities
- Entity column filters now support multiple rules per column.
- Rules within a column and across columns combine with logical AND only.
- Filter flyouts now use stable `Condition` + `Value` controls.
- Active rules render as removable rounded-square pills with `Clear all`.
- Existing one-filter preferences migrate into the multi-rule shape.

### Notification History
- Multiple notification-history filter rules are supported and AND-combined.
- Filter editor uses stable `Condition` + `Value` labels.
- `Is` / `Is not` use severity values; text conditions use a text Value control.
- Active rules render as removable pills; Clear all removes the set.
- Typing into Value no longer rerenders the app per keystroke.

### Notifications
- Hovering a timed toast pauses only that toast.
- Mouse leave resumes from the remaining active-display time.
- Existing severity coalescing and background/blur pause behavior remain.

### Live
- Right-click / Shift+F10 / Context Menu key on a tracked symbol opens a context menu.
- Added `Remove from watchlist`.
- Removal updates comparison membership, active symbol, URL, and persisted Live preferences.
- No market symbols are seeded by Paper Lab; previously tracked symbols survive because the watchlist is intentionally browser-local persisted state.

### Documentation
- Updated D-014 to the multi-rule Entity filtering model.
- Updated D-025 to severity-coalesced toast behavior with hover pause.
- Added D-026 Filter rule grammar.
- Added D-027 Live watchlist ownership/removal.
- Added revised `Entity Retire → Delete` proposal for Claude; no deletion code is included.

## TESTS

- TypeScript client/server/tests check
- 61 automated tests
- new same-column AND filter test
- hover-pause regression test
- Live watchlist context-menu removal regression test
- notification Condition + Value / multi-filter regression test

## DOC/CODE ALIGNMENT NOTES

### ALIGNED
- Live remains explicit user-owned watchlist state; no defaults are seeded.
- Notification history remains complete even though transient toasts coalesce by severity.
- Filters remain presentation/view state and are not audited.

### PENDING ARCHITECTURAL DECISION
- Entity Retire → Delete semantics remain intentionally unimplemented.
- Revised proposal asks Claude whether research-referenced Retired Entities should be undeletable or replaced with immutable tombstones on Delete.

## RISKS

- Browser-local Live preferences survive ZIP/server replacement by design. A user who previously tracked SPY/NVDA will continue to see them until explicitly removed.
- Multiple filter rules can intentionally create contradictory AND conditions and therefore zero-result views; controls remain available to remove those rules.

## FOLLOW-UP

User test 1.3.6. Send the revised Entity Retire → Delete proposal to Claude separately.
