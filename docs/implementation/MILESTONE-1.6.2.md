# Paper Lab 1.6.2 — Portable Import Panel Consistency

## Scope
Frontend interaction correction following the 1.6.0 Portable Research milestone and 1.6.1 Arena/Experience UX follow-up.

## User-visible behavior
- Entity and Arena object-panel Import controls use the same standard 2rem height as adjacent `+` controls.
- Portable Import is a full-height right-side utility panel below the 3rem application header, matching Notification History geometry.
- The same Import control toggles its panel; close button, Escape, and outside-click also dismiss it.
- Import and Notification History are mutually exclusive right-side utilities.
- Narrow mode expands Portable Import to full viewport width below the header.

## Root cause corrected
1.6.1 styled Portable Import with `top: var(--header-height)` even though `--header-height` was not defined. The browser discarded that `top` declaration, leaving the fixed panel anchored by `bottom: 0`, which made it appear like a detached lower-right flyout. 1.6.2 uses the same explicit `top: 3rem` boundary as Notification History.

## Non-impact
No PLPS schema/planning/apply behavior changes. No scientific execution, Experience, Reward, Arena, snapshot, or strategy behavior changes.
