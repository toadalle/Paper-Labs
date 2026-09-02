# Frontend 1.3.6 — Filter Rules, Watchlist Removal, Toast Hover Pause

## Scope

This iteration changes presentation/navigation behavior only. Entity deletion remains unimplemented pending the separate Retire → Delete architecture decision.

## Filters

Filterable regions now support multiple active rules. Rules combine using logical AND only.

The editor uses a stable grammar:

```text
Condition
Value
```

Active rules are displayed as removable rounded-square pills, for example:

```text
Is : SUCCESS
Contains : Entity
```

`Clear all` removes all rules for that filterable location.

Entities support multiple rules per column. Notification History supports multiple history rules. Notification `Is` / `Is not` values use notification severity choices; `Contains` / `Does not contain` values use free text. The Value label remains stable in both cases.

## Live watchlist

Paper Lab does not seed SPY, NVDA, or any other symbol. Live symbols are browser-local preferences and intentionally persist across server restarts and project ZIP upgrades.

Right-clicking a tracked Live symbol opens a context menu with `Remove from watchlist`. Keyboard context-menu invocation is supported via the Context Menu key or Shift+F10. Removing the active symbol selects a remaining watchlist symbol when one exists; otherwise Live returns to an empty state.

## Notifications

Hovering a timed toast pauses only that toast's remaining active-display time. Moving the pointer away resumes the same remaining time. Browser hidden/blur behavior continues to pause all timed toasts globally.
