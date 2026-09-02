# Paper Lab 1.3.0 — Frontend Validation

## Automated checks

- TypeScript client/server/tests: pass.
- Full Node test suite: pass.
- Responsive shell thresholds scale with root font size.
- Old unreachable-panel media-query rules are absent.
- Flyout placement clamps/flips within viewport bounds.
- Large Entity (500 rows) and Console Log (2,000 rows) render paths remain table-viewport based.
- Keyboard-selectable row infrastructure covers Entities, Live, Arena, Evolution, Console Log, and Console Audit selections.

## Static layout harness

The actual 1.3 stylesheet was exercised in headless Chromium against representative shell markup.

| Mode | Viewport | Page horizontal overflow | Table viewport | Table content |
|---|---:|---|---:|---:|
| Desktop | 1366×768 | none | 805px | 1248px (local scroll) |
| Constrained | 900×700 | none | 885px | 1248px (local scroll) |
| Narrow | 390×844 | none | 375px | 1248px (local scroll) |
| Narrow | 360×740 | none | 345px | 1248px (local scroll) |

Additional shell-state checks verified:

- Constrained Objects overlay can be visible while Workspace remains visible.
- Constrained Inspector overlay can be visible while Workspace remains visible.
- Narrow Objects, Workspace, and Inspector surfaces can each be made the sole active surface.
- Narrow Notification Center and toast stack stay within a 390px viewport.
- Coarse-pointer emulation produces 44px interaction targets for primary navigation and table tools.

## Runtime smoke

The built application was started without `.env` and verified to:

- report version 1.3.0,
- open SQLite,
- run market-data integrity startup sweep,
- listen successfully on the configured local server,
- serve `/live`, `/entities`, `/arenas`, `/evolution`, `/benchmark`, and `/console`,
- return Console overview with version 1.3.0.

## Post-release visual verification

The user's real Chrome environment remains the final visual acceptance surface for browser zoom, OS scaling, fonts, actual Alpaca chart data, and real interaction feel. Any polish defects found there remain `1.3.x` iterations rather than reopening the 1.3 design.
