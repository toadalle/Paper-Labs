# Paper Lab 1.1.0 — Entities + Live Interaction Milestone

## Status

Implemented from the closed GPT/Claude Entities + Live interaction design.

## Pass A — Entities

- Recent/Pinned Objects navigation
- quick-create retained without modal
- centered Workspace search
- lifecycle Objects dropdown removed
- single active sort owner
- one context-aware filter per column
- cross-column filters combine with AND
- Permanent default preserved
- quick-create visibility guarantee clears search/filters before Candidate selection
- view preferences persisted locally

## Pass B — Live

- provider-backed asset search
- Investments and Crypto object sections
- persisted added-symbol list and Compare% membership
- historical chart ranges 1D / 5D / 1M / 3M / YTD / 1Y / MAX
- Candles + Volume / Candles / Line
- Compare% line normalization
- symbol vs chart Inspector context
- provider-neutral asset/quote/history endpoints
- ephemeral display-data boundary preserved: no Live browsing snapshot capture

## Chart implementation choice

V1 uses a deliberately bounded internal SVG renderer rather than adding a third-party chart dependency. It provides the current required candlestick, volume, line, compare, axis, responsive, and hover/crosshair behavior while keeping the dependency surface minimal. If future analytical needs exceed this renderer's scope, chart-library adoption should be evaluated as an explicit implementation decision rather than accumulated ad hoc complexity.

## Non-goals retained

No streaming/WebSocket pipeline, live brokerage/orders, Portfolio, scored Arena use of Live chart state, complex filter boolean expressions, multi-column sorting, or multiple filters per column.


## Iteration 1.1.1 — local interaction corrections

The first local test of 1.1.0 exposed interaction defects rather than design changes. 1.1.1 corrects those without reopening the closed milestone design.

### Entities

- table headers remain present when filters return zero rows
- filter flyouts render as fixed overlays anchored to their trigger rather than inside the scroll-clipped table
- broad search moved to the visual center of the Workspace header and gained an explicit clear control
- broad search now matches displayed values across all row columns (and the visible Entity ID) and highlights matched text
- outside-click / Escape dismisses custom flyouts

### Live

- symbol search is the sole add-symbol interaction; redundant `+` removed
- asset search results exclude already-added watchlist symbols
- asset-search flyout dismisses on outside click / Escape
- chart presentation is unified into one dropdown containing Candles + Volume / Compare% / Candles / Line
- reselecting the active symbol is idempotent and does not refetch
- Compare% checkbox interaction no longer bubbles into symbol selection
- both Inspector contexts expose Actions, Mouse details, and shared Chart setup controls
- chart hover snaps to loaded data points and writes OHLCV/Compare details into the Inspector
- mouse wheel zoom and horizontal drag pan use an ephemeral in-memory viewport over already-loaded bars

These interactions remain view-state only. Zoom/pan/search/filter activity does not enter AuditEvent or MarketDataSnapshot research evidence.

## Iteration 1.1.2 — routine UX corrections

Local testing of 1.1.1 identified correction-level issues rather than new Entities/Live design changes. 1.1.2:

- removes the browser-native search cancel affordance by using the app-owned clear control only;
- keeps the app clear `×` permanently present and debounces broad search application by 200 ms;
- moves Objects shown/total statistics above Recent;
- uses the same visible A–Z / Z–A sorting affordance for every table column while retaining semantically correct accessible sort labels;
- prevents selection through Recent/Pinned from mutating search/filter state;
- removes the system diagnostics export control from Live Inspector in preparation for the separately designed Console workspace.

Notifications + Console are deliberately not implemented here. Their accepted design is stored in `collaboration/handoffs/GPT-5.6-SOL-notifications-console-design-closed.md` for milestone 1.2.0.
