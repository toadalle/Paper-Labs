# Paper Lab 1.1.1 — Interaction Correction Handoff

**Model:** GPT-5.6 Sol  
**Version:** 1.1.1  
**Thread:** implementation / frontend  
**Status:** routine milestone iteration — user testing requested; no Claude review required unless milestone is being closed

---

## RESULT

Corrected the concrete Entities and Live interaction defects found during local testing of 1.1.0. No new feature scope or architecture was introduced.

## FILES CHANGED

Manifest diff `1.1.0 → 1.1.1`: **2 added**, **13 modified**, **0 removed** tracked files. See `CHANGELOG` below.

## TESTS

```text
client typecheck PASS
server typecheck PASS
test typecheck PASS
38 / 38 tests PASS
build PASS
runtime startup PASS
bootstrap version 1.1.1 PASS
/live SPA route PASS
```

## SPEC SECTIONS

Aligned with the closed Entities + Live design, frozen no-modal/flyout behavior, shared-state-owner rule, Objects/Workspace/Inspector interaction model, and ephemeral Live display-data boundary.

## DEVIATIONS

```text
None intentionally accepted.
```

## RISKS

1. Interactive zoom/pan is intentionally bounded to the bars already loaded for the selected human range; it does not request older/newer data while panning.
2. Real Alpaca symbol search/market-data behavior still depends on the user's configured account/feed entitlements.
3. The internal SVG chart remains deliberately bounded; more advanced analytical tooling may justify a chart-library decision later.

## FOLLOW-UP

Continue local milestone testing. Claude is reserved for milestone closure, feature/design requests, or architecture/spec-risk questions rather than routine interaction iterations.

---

## CHANGELOG

### Live

- `src/frontend/pages/live.ts` — removed redundant Live `+`, filters already-added symbols from search, unified Compare% into chart presentation dropdown, added shared Actions / Mouse details / Chart setup Inspector sections.
- `src/frontend/live/chart.ts` — added in-memory chart viewport, zoom/pan helpers, snapped single/compare hover-point calculations, and Inspector-oriented mouse detail data.
- `src/frontend/main.ts` — outside-click/Escape flyout dismissal, idempotent active-symbol selection, fixed Compare checkbox propagation, unified presentation handling, Inspector action wiring, wheel zoom, horizontal drag pan, snapped hover/Inspector updates.
- `public/styles.css` — clickable navigation cursor, chart interaction cursors, selectable chart header, search-clear control, fixed filter overlay styling, search-hit styling.

### Entities

- `src/frontend/pages/entities.ts` — centered search + clear control, table remains rendered on zero results, filter flyout moved out of scroll-clipped table into fixed overlay, matched row values highlighted.
- `src/frontend/entities/model.ts` — broad search now evaluates displayed values across every data column plus visible Entity ID rather than only Name/Family/ID.

### Tests

- `tests/entity-view.test.ts` — verifies search across Lifecycle/Consistency and confirms column-header labels themselves do not match.
- `tests/chart-interaction.test.ts` — new viewport zoom/pan and snapped hover-detail tests.
- `tests/live-boundary.test.ts` — updated Compare% line-only assertion to the current presentation architecture instead of an obsolete implementation detail.

### Metadata / docs

- `package.json`, `package-lock.json`, `src/domain/version.ts` — version 1.1.1.
- `README.md` — current iteration behavior.
- `docs/implementation/MILESTONE-1.1.0.md` — records 1.1.1 as interaction corrections inside milestone 1.1.
- this handoff — manifest-backed iteration record.

---

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- no modal introduced
- Live search is the sole add-symbol path
- Compare membership remains explicit checkbox state
- Compare% remains line-only but now appears in the same presentation dropdown as other chart modes
- Live chart zoom/pan is ephemeral view state and does not create MarketDataSnapshots
- symbol and chart Inspector contexts use the same chart-state owner
- Entity zero-result filters retain filter access
- broad search applies in addition to structured filters and highlights only row values, never header labels

### PENDING

```text
No new pending design decision created by this iteration.
```

### UNRECORDED DECISION

```text
None known at packaging time.
```

### DEVIATION

```text
None known at packaging time.
```
