# Paper Lab — Entities + Live Workspace Design Closure

**Model:** GPT-5.6 Sol + Claude (Sonnet 5) convergence summary  
**Thread:** frontend / implementation  
**Status:** accepted / closed for 1.1.0 implementation

## Version boundary

```text
1.0.3 = foundation closeout
1.1.0 = Entities + Live interaction milestone
```

1.1.0 uses two internal passes: Entities first, Live second.

## Entities — settled interaction contract

Objects becomes:

```text
Entities                         [+]

RECENT
...

PINNED
...
```

- Search moves to the Workspace header.
- The old Objects lifecycle dropdown is removed.
- Each applicable table column has independent sort and filter controls.
- Exactly one sort column is active at a time.
- Each column may have zero or one filter; filters across columns combine with AND.
- Text operators: `is`, `is not`, `contains`, `does not contain`.
- Enum operators: `is`, `is not`, with valid-value dropdowns.
- Numeric operators: `=`, `≠`, `>`, `<`, `≥`, `≤`.
- Date/time operators initially: `before`, `after`.
- Filters use anchored flyouts, never modals.
- Ordinary Entities entry retains visible `Lifecycle is Permanent` default filtering.
- Quick Create guarantees visibility by clearing the broad Workspace search and every active column filter, then applying `Lifecycle is Candidate`, selecting the new Entity, and scrolling it into view if necessary.
- Sorting is not cleared by Quick Create because sorting never hides rows.
- Recent and Pinned are local navigation/view preferences and are not audited domain state.

## Live — settled interaction contract

Objects becomes a provider-backed symbol browser:

```text
Live                             [+]

[ Search symbols... ]

INVESTMENTS
SPY                              [✓]
NVDA                             [ ]

CRYPTO
BTC/USD                          [ ]
```

- Clicking a symbol selects it, updates the chart, and switches Inspector to symbol context.
- Each row checkbox is the sole source of Compare% membership.
- The active symbol is not implicitly added to Compare%.
- `+` focuses/opens symbol search rather than opening a modal.
- Alpaca's crypto market-data capability is architecture-enabled; crypto trading remains out of scope.
- Required ranges: `1D`, `5D`, `1M`, `3M`, `YTD`, `1Y`, `MAX`.
- Normal chart modes: `Candles + Volume`, `Candles`, `Line`.
- Compare% always renders normalized line series, disables the normal chart-mode selector while active, remembers the previous normal mode, and restores it when Compare% is disabled.
- Clicking a symbol uses symbol Inspector context; clicking chart title/header uses chart Inspector context.
- Toolbar and Inspector consume one shared chart-state owner.

## Live data / research-data boundary

Live browsing is ephemeral display data:

```text
MarketDataProvider → Live display
```

Asset search, latest quote/trade, and historical chart-range reads do **not** create `MarketDataSnapshot` records.

Only Arena-bound scored research promotes provider data into canonical immutable evidence:

```text
Arena evaluation
→ MarketDataProvider
→ normalized dataset
→ MarketDataSnapshot
→ Experience
```

Changing chart range, refreshing, selecting a symbol, or enabling Compare% must never create a research snapshot.

## Explicit non-goals for 1.1.0

- live brokerage deployment
- Portfolio
- order placement
- WebSocket streaming
- crypto trading
- multi-column sort
- more than one filter per column
- OR/boolean filter groups
- regex/case-sensitive filters
- Live chart data directly becoming Arena evidence
