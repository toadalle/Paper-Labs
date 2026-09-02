# Paper Lab 1.6.2 — Import Panel Consistency

## Scope
UI-only Portable Research follow-up.

## Changes
- Portable Import moved to the same full-height right-side panel model as Notification History.
- Fixed prior invalid `top: var(--header-height)` declaration (the variable was undefined), which caused the fixed panel to anchor from the bottom instead of below the application header.
- Added outside-click dismissal and same-control toggle behavior.
- Import and Notification panels are mutually exclusive.
- Entity/Arena Objects Import buttons now use the same standard 2rem control height as adjacent + buttons.

## Scientific impact
None. PLPS semantics, domain mutation planning, evaluation engine, indicator library, and research outputs are unchanged.
