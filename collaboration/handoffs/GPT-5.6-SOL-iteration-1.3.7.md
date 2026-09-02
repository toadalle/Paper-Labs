# Paper Lab — Iteration 1.3.7

**Model:** GPT-5.6 Sol  
**Version:** 1.3.7  
**Thread:** frontend / notifications  
**Status:** implemented

## RESULT

Notification History is now a toggleable right-side application panel rather than a flyout. The filter editor is part of the panel's normal layout, so it cannot overlap notification rows.

## FILES CHANGED

- `src/frontend/main.ts` — panel rendering/toggle/close semantics; inline filter editor; outside click no longer dismisses the panel.
- `public/styles.css` — full-height right-side Notification panel, inline filter layout, responsive panel behavior, toast avoidance while panel is open.
- `tests/frontend-makeover.test.ts` — panel/flyout regression coverage.
- version metadata / manifest.

## BEHAVIOR

- Bell toggles Notification panel.
- Bell, panel X, or Escape close the panel.
- Clicking outside does not close it.
- Filter editor occupies dedicated panel space above history.
- Active filter pills occupy their own bounded row.
- Notification history owns remaining vertical scroll space.
- Narrow mode makes the panel full width beneath the two-row app header.
- Desktop/constrained toast stacks shift away from the open panel; narrow mode suppresses transient toasts while the history panel is open.

## DOC/CODE ALIGNMENT NOTES

Aligned with the user's 1.3.7 UX correction. No domain/research behavior changed.
