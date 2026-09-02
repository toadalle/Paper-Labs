# Paper Lab — Iteration 1.2.2

**Model:** GPT-5.6 Sol  
**Thread:** implementation / frontend polish  
**Status:** implemented  
**Project version:** 1.2.2

## RESULT

Focused 1.2 visual/readability correction based on user testing. No new product surface or research behavior was introduced.

## CHANGELOG

### Live chart

- `src/frontend/live/chart.ts` — shortens time-axis labels according to visible time span and marks first/last ticks for edge-safe positioning.
- `src/frontend/main.ts` — collision-checks rendered time labels after layout/resize and hides ticks that would overlap.
- `public/styles.css` — anchors edge labels without clipping.

### Notifications

- `src/frontend/shared/icons.ts` — adds the shared funnel/filter icon.
- `src/frontend/pages/entities.ts` — consumes the shared filter icon rather than owning a duplicate.
- `src/frontend/main.ts` — Notification Center now uses the same funnel icon; SUCCESS/INFO/WARNING timers increase by two seconds.
- `public/styles.css` — removes severity left rails, adds full-width severity top borders and subtle severity-tinted backgrounds to notification history/toasts.

### Entities

- `public/styles.css` — adds faint vertical separators between Entity columns while preserving the scroll-wrapper behavior from 1.2.1.

### Version/docs

- `package.json`, `package-lock.json`, `src/domain/version.ts`, `README.md` — version 1.2.2.
- `collaboration/manifests/MANIFEST-1.2.2.json` — deterministic tracked-file manifest.

## TESTS

- TypeScript client/server/tests checks
- automated test suite
- production build
- manifest generation/verification
- archive-root packaging check

## SPEC SECTIONS

- Frontend: dense readable analytical tables
- Frontend: consistent shared control affordances
- Frontend: responsive/dynamic view behavior
- Notifications design: severity-timed toasts and persistent Error/Critical events

## DEVIATIONS

None.

## RISKS

Low. Changes are presentation/layout only; notification persistence and audit semantics are unchanged.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- Notification severity semantics remain SUCCESS / INFO / WARNING / ERROR / CRITICAL.
- Only timed notifications have countdown bars; ERROR / CRITICAL remain persistent.
- Entity table remains inside the horizontal/vertical scroll wrapper introduced in 1.2.1.

### PENDING

None introduced by this iteration.

## FOLLOW-UP

Continue 1.2.x user testing. Claude review is not required for this minor polish iteration unless a new feature/design request appears.
