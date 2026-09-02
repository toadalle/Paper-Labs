# Paper Lab 1.1.0 — Entities + Live Interaction Milestone Handoff

**Model:** GPT-5.6 Sol  
**Version:** 1.1.0  
**Thread:** implementation / frontend / market observation  
**Status:** milestone implementation complete — user test + Claude milestone review requested

---

## RESULT

Implemented the closed Entities + Live interaction design as one milestone with two internal passes.

### Pass A — Entities

- Objects panel now exposes `Recent` and `Pinned`; old Objects search/lifecycle controls are removed.
- Entity search is centered in the Workspace header.
- Every Entity table column has a sort control and context-aware filter control.
- Exactly one column owns sort state; direction toggles ascending/descending.
- At most one filter exists per column; filters across columns combine with logical AND.
- Text, enum, numeric, and date filters use deliberately small context-appropriate operator sets.
- Filter UI is an anchored flyout with the established trigger gap; no modal.
- Permanent remains the ordinary default lifecycle filter.
- Quick Create guarantees the new Candidate is visible by clearing broad search + all active filters, applying `Lifecycle is Candidate`, selecting the row, and revealing it.
- Recent/Pinned/sort/filter state persists locally and does not enter domain/audit state.
- `+` glyph optical alignment corrected.

### Pass B — Live

- Live Objects panel now contains provider-backed symbol search plus `Investments` and `Crypto` sections.
- Selecting a search result adds/persists the object and makes it the active chart/Inspector symbol.
- Each Live object has an independent Compare% checkbox.
- Added ranges: `1D / 5D / 1M / 3M / YTD / 1Y / MAX`.
- Added modes: `Candles + Volume / Candles / Line`.
- Added responsive native SVG chart renderer with candlesticks, volume, line view, axes, hover data, and crosshair.
- Compare% normalizes only explicitly checked symbols and forces line rendering while active.
- Clicking a symbol selects Symbol Inspector context; clicking the chart title selects Chart Inspector context.
- Chart Inspector edits the same range/mode/feed state owner as toolbar controls.
- Provider-neutral asset-search and historical-chart contracts added.
- Alpaca implementation now supports US-equity asset search/history/quotes and crypto asset search/history/quotes.
- Live display reads explicitly bypass `MarketDataSnapshot`; only Arena-bound scored evaluation enters snapshot/provenance capture.

---

## FILES CHANGED

See `CHANGELOG` below. Current manifest records:

```text
9 added tracked files
17 modified tracked files
0 removed tracked files
```

---

## TESTS

```text
npm run check
```

Result:

```text
35 / 35 tests PASS
client typecheck PASS
server typecheck PASS
test typecheck PASS
```

Runtime smoke:

```text
server startup PASS
bootstrap version 1.1.0 PASS
/live SPA route PASS
asset-search route fails explicitly when credentials absent PASS
structured startup/shutdown logs PASS
```

The Live Alpaca network paths require the user's real `.env` and should be exercised during local milestone testing.

---

## SPEC SECTIONS / DECISIONS

Aligned with:

- frozen frontend Objects / Workspace / Inspector shell
- modal-avoidance rule
- single-state-owner rule
- provider-neutral market-data boundary
- Architecture Amendment 001 provenance boundary
- D-014 through D-019 in `DECISIONS-LOG.md`
- closed Entities + Live interaction handoff in `collaboration/handoffs/GPT-5.6-SOL-entities-live-design-closed.md`

---

## DEVIATIONS

```text
None intentionally accepted.
```

Chart implementation choice is not a spec deviation. The closed design required choosing a chart implementation during planning but did not mandate an external library. V1 intentionally uses a bounded internal SVG renderer and documents the point at which a future library should be reconsidered.

---

## RISKS

1. Alpaca asset-catalog/crypto endpoints require real-account validation in the user's environment; automated tests cannot validate external provider entitlements.
2. Native SVG rendering is intentionally bounded. If future chart requirements become substantially more complex (indicators, drawing tools, multi-pane analytics, very large streaming datasets), replace/augment it deliberately rather than growing an accidental charting framework.
3. Entity `Consistency` and `Age` are display metrics derived server-side from currently available valid completed Experiences. They are presentation/list metrics and are not substitutes for future policy-specific survival/promotion calculations.
4. Live remains polling/on-demand historical observation. Streaming/WebSocket lifecycle remains explicitly deferred.

---

## CHANGELOG

The changed path set is derived from `MANIFEST-1.0.3.json` → `MANIFEST-1.1.0.json`, not from model memory.

### Added — application / frontend

- `src/application/live/chart-query.ts` — centralizes human Live ranges into provider query windows/timeframes.
- `src/frontend/entities/model.ts` — owns pure Entity sort/filter semantics.
- `src/frontend/live/chart.ts` — bounded SVG candles/volume/line/Compare% renderer and hover formatting.
- `src/frontend/shared/preferences.ts` — best-effort local UI preference persistence.

### Added — tests

- `tests/entity-view.test.ts` — AND-combined filters, search, deterministic sort behavior.
- `tests/live-boundary.test.ts` — proves Live provider reads do not invoke snapshot capture and Compare% remains line-only.
- `tests/live-query.test.ts` — validates centralized range policy.

### Added — documentation / collaboration

- `docs/implementation/MILESTONE-1.1.0.md` — canonical implementation summary and chart implementation decision.
- `collaboration/handoffs/GPT-5.6-SOL-milestone-1.1.0.md` — manifest-backed milestone handoff, changelog, and alignment notes.

### Modified — frontend

- `src/frontend/main.ts` — shared state ownership, Entities Recent/Pinned/sort/filter/search flow, Live asset/search/chart/Compare%/Inspector interaction, URL and local-preference handling.
- `src/frontend/pages/entities.ts` — new Objects layout, centered search, header controls/flyouts, metric rendering, pin controls.
- `src/frontend/pages/live.ts` — symbol browser, chart toolbar, Live Objects, dual Inspector contexts.
- `src/frontend/types.ts` — Entity metrics and Live asset/chart API view types.
- `public/styles.css` — filter flyouts, object lists, search flyout, chart toolbar, SVG chart/crosshair, responsive workspace styles, plus alignment fix.

### Modified — provider/application/server

- `src/domain/types.ts` — provider-neutral `MarketAssetClass`, `MarketAsset`, and quote asset-class metadata.
- `src/application/bootstrap.ts` — server-owned Entity list metrics.
- `src/infrastructure/market-data/provider.ts` — asset search + asset-class-aware quote/history contracts.
- `src/infrastructure/market-data/alpaca.ts` — asset catalog cache/search, US-equity and crypto quote/history support.
- `src/server/routes.ts` — `/api/market/assets`, asset-class-aware quote, and ephemeral `/api/market/chart` endpoints.

### Modified — tests / metadata / docs

- `tests/snapshot.test.ts` — FakeProvider updated for expanded provider contract.
- `package.json` / `package-lock.json` / `src/domain/version.ts` — version 1.1.0.
- `README.md` — 1.1.0 usage/scope.
- `docs/decisions/DECISIONS-LOG.md` — D-014 through D-019.
- `docs/implementation/WORKFLOW.md` — Claude review cadence refined to milestone/feature/spec-risk review rather than every minor patch.

---

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- Recent/Pinned live only in UI preferences and do not generate AuditEvents.
- Quick Create clears both global search and all filters before applying Candidate, matching the final Claude refinement.
- One active sort owner; filters remain independently multi-column AND.
- Live asset browsing/quote/chart endpoints call `MarketDataProvider` directly and do not call `MarketDataSnapshotService.capture()`.
- Compare% membership is checkbox-only; active symbol is not implicitly included.
- Compare% forces line presentation and disables normal mode editing while active; normal mode state is preserved.
- Both Investments and Crypto are represented in provider/UI contracts.
- Symbol and chart Inspector contexts consume one Live state owner.
- No creation, filter, or symbol-add modal was introduced.

### PENDING

Settled non-goals remain intentionally unimplemented:

```text
WebSocket/streaming Live data
live brokerage/order placement
Portfolio
Arena scoring from Live chart state
multi-column sorting
multiple filters per column
OR/boolean filter groups
advanced chart types/indicators
```

### UNRECORDED DECISION

```text
None known at packaging time.
```

### DEVIATION

```text
None known at packaging time.
```

---

## REVIEW REQUEST

Per the refined workflow, this is a milestone boundary and should receive Claude manager review after the user's local functional test.

Focus review on:

1. Does the Entity interaction grammar remain faithful to the closed design?
2. Does Quick Create genuinely guarantee visibility under persisted filter/search state?
3. Does the Live path remain cleanly outside MarketDataSnapshot research capture?
4. Is the provider-neutral US-equity/crypto split maintainable without leaking Alpaca-specific assumptions into frontend/domain state?
5. Does Compare% obey explicit membership and line-only rendering?
6. Are Recent/Pinned/table/Live preferences correctly kept out of audited domain state?
7. Does the manifest-derived changelog account for the full 1.0.3 → 1.1.0 tracked diff?

