# Paper Lab — Decisions Log

## D-001 — Product identity
Paper Lab is an Entity research system first, evolutionary simulation second.

## D-002 — Clean V1 lineage
Version 1.0.0 is a clean implementation line. Legacy Training/Replay/Agent/Challenge architecture is reference material only and is not preserved for compatibility.

## D-003 — Versioning
Project version format is `MAJOR.MILESTONE.ITERATION`. A returned ZIP is the version bump. Archive naming is `paper_labs_<version>.zip`.

## D-004 — Packaging
Project-root contents appear directly at ZIP root. No wrapper directory is included.

## D-005 — Source provider
Alpaca remains the V1 default provider, behind a provider-neutral `MarketDataProvider` boundary.

## D-006 — Secrets
Real `.env` files are local only. Project artifacts contain `.env.example` with placeholders.

## D-007 — Project state
Git/GitHub are not part of the operating workflow. ZIP artifacts are the versioned project states.

## D-008 — Entity quick-create
The Entities + action creates a Candidate immediately with a server-owned `New Entity N` name and selects it for Inspector editing. Ordinary creation does not use a modal.

## D-009 — Default Entity sequence
`N` comes from a persisted monotonic SQLite counter reserved transactionally. Entity numbering never reuses lower values, including Retired or renamed Entities.

## D-010 — Observability boundaries
Operational LogEvents, durable AuditEvents, and scientific ExperienceEvents are separate evidence streams. Required audit failure blocks its research-critical mutation; ordinary log-sink failure does not.

## D-011 — Live foundation
The Live workspace in V1 means market observation only. On-demand quotes are implemented first; streaming and live brokerage deployment remain deferred.

## D-012 — Snapshot compromise is integrity-triggered
`ResearchIntegrityService.compromiseSnapshot()` is an internal transition mechanism, not a generic user action. Stored snapshot artifacts are verified by `MarketDataIntegrityService`; hash mismatch or unreadable persisted evidence triggers the compromise path. Provider-side historical revisions remain `SUPERSEDED`, not `COMPROMISED`.

## D-013 — Manifest-backed consistency review
ZIP versions use SHA-256 file manifests under `collaboration/manifests/`. Runtime/build state and the manifest directory itself are excluded. Changelogs are checked against manifest differences, and `DOC/CODE ALIGNMENT NOTES` record known alignment state at packaging time. Version 1.0.2 is the one-time full consistency baseline; 1.0.3+ use changelog-scoped review unless a full sweep is explicitly triggered.

## D-014 — Entity table interaction grammar
Entities uses Recent/Pinned in Objects, broad search in the Workspace header, exactly one active sort column, and multiple removable filter rules per column. All active filter rules combine with logical AND, both within one column and across columns. Column filters use anchored Condition + Value flyouts with removable rule pills; creation/filtering does not use modals. Permanent remains the ordinary default view. Quick Create clears broad search and all existing column filters, applies `Lifecycle is Candidate`, selects the new Entity, and guarantees it is visible.

## D-015 — Recent and Pinned are view preferences
Entity Recent/Pinned lists, table sort/filter state, Live added symbols, comparison membership, active symbol, range, and chart mode are local presentation/navigation preferences. They do not change research state and do not generate AuditEvents.

## D-016 — Live display data is ephemeral
Live asset search, quotes, and historical chart reads go directly through the provider-neutral `MarketDataProvider` display path. They do not create `MarketDataSnapshot` records. Only Arena-bound scored evaluation promotes market data into the immutable snapshot/provenance evidence path.

## D-017 — Compare% rendering
Compare% membership is controlled only by each Live object's checkbox. The active symbol is not implicitly included. Compare% always uses normalized line rendering; the normal chart-mode control is disabled while Compare% is active and the user's normal mode is preserved for restoration afterward.

## D-018 — Live asset classes
The Live workspace architecture supports both US-equity Investments and Crypto. Alpaca remains the V1 provider for both where account/provider capabilities permit. Crypto market observation is not crypto trading or brokerage deployment.

## D-019 — Review cadence during implementation
Routine minor fixes and polish are handled directly between the user and GPT. Claude manager review is reserved for milestone boundaries, new feature/design requests, and architecture/spec-risk questions unless the user explicitly requests an additional review.


## D-020 — Notifications and Console
`NotificationEvent`, `AuditEvent`, and `LogEvent` remain separate because they have different mutability and trust guarantees. Notification history is durable user-facing presentation history with mutable seen/dismissed state and no Clear-All action. Audit remains append-only/tamper-evident research/application evidence. Console is the sole top-level home for system overview, logs, AuditEvent inspection, diagnostics export, audit verification, and market-data artifact verification. Notification toasts use SUCCESS / INFO / WARNING / ERROR / CRITICAL; ERROR/CRITICAL persist until dismissed, while timed severities pause their countdown whenever Paper Lab is hidden or loses browser focus.

## D-021 — Responsive shell modes
Paper Lab has three capability-derived frontend shell modes. Research Desktop keeps Objects/Workspace/Inspector visible together. Whenever the responsive surface selector appears (Constrained or Narrow), it is the primary focus controller and exactly one of Objects/Workspace/Inspector owns the working area at a time. Major panels may never become unreachable through CSS-only hiding.

## D-022 — Table preservation default
The previous generic column-priority-hiding behavior is superseded. Analytical tables preserve meaningful columns and readable minimum widths, then scroll locally. Automatic priority hiding is now an explicit per-table exception rather than the default.

## D-023 — Narrow deliberate-selection behavior
In Narrow mode, deliberate target/context selection (including Entity, Live symbol, Live chart header, Console Log/Audit, Arena, and Evolution run selection) switches to Inspector automatically. View adjustments such as search, filtering, sorting, chart range/presentation changes, scrolling, and Compare% checkbox changes do not auto-navigate.


## D-024 — Live watchlist starts empty
Live does not add a default market symbol. The user explicitly adds the Investments/Crypto symbols they want to observe. A direct `/live?symbol=...` deep link may still open that explicitly requested symbol.


## D-025 — Burst notification presentation
Transient notification presentation is coalesced by severity: a newer notification replaces the currently visible/queued toast of the same severity, while different severities may coexist. Notification history remains complete. Toast DOM is hosted outside the full application rerender tree, each toast owns its own remaining active-display time, and hovering a timed toast pauses only that toast. Background/blur pausing remains global.


## D-026 — Filter rule grammar
Filterable UI locations may hold multiple active rules. Rules combine with logical AND only in V1. Editors use a stable `Condition` + `Value` grammar; active rules render as removable rounded-square pills such as `Is : SUCCESS` or `Contains : Entity`, with a `Clear all` action. Context may change the Value control type (for example severity dropdown vs text input), but not the structural labels.

## D-027 — Live watchlist ownership
Live watchlist symbols are explicit local user preferences and are not seeded by Paper Lab. They persist across server restarts/ZIP upgrades in browser-local preference state. A Live object context menu provides `Remove from watchlist`; removing the active symbol selects a remaining tracked symbol when available or returns Live to an empty state.

## D-028 — Entity Retire → Delete and always-tombstone removal
Candidate/Permanent Entities must Retire before Delete becomes available. Delete removes a Retired Entity from the working population but never erases immutable research/audit evidence. Every deletion creates an immutable minimal `EntityTombstone` regardless of currently known references; tombstone creation, working-Entity removal, and `ENTITY_DELETED` AuditEvent append commit atomically. `DELETED` is not a fourth lifecycle state, and Entity IDs/default `New Entity N` values are never reused. Inspector and right-click context menu render the same lifecycle-action rule.

## D-029 — Candidate executable readiness
Candidate remains the Entity lifecycle state and gains `configuration_status = DRAFT | READY`. Quick Create produces DRAFT. DRAFT strategy configuration may be persisted and edited but cannot evaluate, breed, survival-rank, or promote. DRAFT → READY validates and freezes strategy type/version/traits plus deterministic trait hash; READY birth configuration cannot return to DRAFT or be rewritten.

## D-030 — Versioned Strategy contract
Executable Entity behavior is `strategyType + strategyVersion + immutable validated traits`, interpreted by a registered StrategyDefinition. V1 baseline is `MOVING_AVERAGE_CROSS` v1. Strategies emit long-only `HOLD` / `TARGET_POSITION` intent; account sizing/execution remains centralized. Strategy/observation contracts are symbol-keyed even though V1 Arenas trade one symbol.

## D-031 — Shared bounded indicator library
Core indicators are implemented in a shared deterministic library with an explicit `INDICATOR_LIBRARY_VERSION`. Indicator functions receive bounded permitted history only, never full MarketDataSnapshot/provider/repository handles. Every completed Experience stamps the indicator-library version.

## D-032 — Arena / ExecutionPolicy / RewardPolicy separation
Arena versions own symbol, evaluated window, initial capital, warmup, snapshot identity, and references to separate immutable ExecutionPolicy and RewardPolicy objects. Arena families use immutable version records under one `rootArenaId`; changes create the next family version and used versions lock rather than being overwritten.

## D-033 — Executable-research temporal contract
`Arena.start` is the first fully-informed evaluated decision bar; snapshot capture extends backward for warmup and warmup is excluded from evaluated returns. V1 observes completed bar `t`, decides using data through `t`, and fills at bar `t+1` open. Open terminal positions are forcibly liquidated at the final evaluated bar close.

## D-034 — EvaluationRun and immutable Experience
EvaluationRun is mutable job state; Experience is immutable scientific evidence. CANCELLED and FAILED EvaluationRuns produce no Experience. A correctly executed Experience may be COMPLETED even with negative Reward or failed hard gates. V1 executes isolated simulation state in memory and atomically persists Experience, ExperienceEvents, ExperienceTrace, completion state, and required AuditEvent.

## D-035 — ExperienceEvent / ExperienceTrace split
ExperienceTrace owns dense immutable market/account/benchmark/decision state and explicitly marks warmup vs evaluated points. ExperienceEvents own discrete causal actions/transitions. Because a FAILED EvaluationRun produces no Experience, V1 failure evidence is EvaluationRun failure state + `EVALUATION_FAILED` AuditEvent rather than an orphan `EXPERIENCE_FAILED` ExperienceEvent; the latter name is reserved pending future evidence ownership requirements.

## D-036 — V1 benchmark, activity, and Reward evidence
Single-symbol V1 uses buy-and-hold from first evaluated bar open through final evaluated bar close as benchmark. Reward remains excess return minus λ times max drawdown. Forced terminal liquidation is system cleanup and does not count toward minimum strategy activity. Reward components and every HardGateResult are persisted backend-side; frontend surfaces never recompute scientific formulas.

## D-037 — Executable-research reproducibility stamps
Every completed 1.5 Experience stamps Entity/strategy identity, immutable strategy-trait snapshot plus trait hash, Arena ID/version, MarketDataSnapshot ID/content hash, ExecutionPolicy ID/version, RewardPolicy ID/version, execution-engine version, and indicator-library version. V1 has no runtime randomness; a seed becomes mandatory if randomness is later introduced.

## D-038 — EvaluationRun terminal outcome ownership
Evaluation failure handling may transition an EvaluationRun to `FAILED` only when the currently persisted run is still `RUNNING`. If a concurrent terminal transition has already occurred—most importantly user cancellation while an awaited operation such as snapshot loading is in progress—the failure path preserves that persisted terminal state and must not emit `EVALUATION_FAILED`. A cancelled EvaluationRun remains `CANCELLED`, retains its `EVALUATION_CANCELLED` AuditEvent, and produces no Experience, ExperienceEvent, or ExperienceTrace.


## D-039 — Arena authoring and evaluation entry points
Arena creation exposes its supported timeframe explicitly rather than hiding `1Day` as an implementation constant. Required research identity/window fields are entered deliberately; optional execution/reward policy fields may be left blank to use visible server defaults. Numeric controls must use browser-valid step semantics. A selected immutable Arena exposes `Run Evaluation` in its Inspector for READY active Candidate Entities, using the same evaluation application path as Entity Inspector evaluation. Failed DRAFT strategy validation preserves the user's attempted values across notification/application rerenders so error messages remain attached to the values that caused them.

## D-040 — PLPS v1 Portable Research contract
Paper Lab Portable Specification (PLPS) v1 is the shared declarative configuration layer for UI Import and future LLM/API automation. Canonical V1 representation is strict human-readable JSON with envelope `format=paper-lab`, `version=1`, and `kind`. Import never writes repositories directly; every document resolves through a server-side ImportPlan into ordinary Application Service/domain commands. The same code is context-sensitive: Objects Import creates, selected objects patch, READY Entity birth changes create a Variant, and used Arena changes create a new version. Missing fields are unspecified, nullable `null` means explicit clear, unknown/protected fields are rejected, and Import never finalizes DRAFT Entities.

## D-041 — Portable bundle atomicity and snapshot PREPARE boundary
PLPS bundle atomicity covers the domain object graph plus its mutation AuditEvents. Arena market-data snapshot capture is an external PREPARE phase before the atomic domain commit. A valid immutable content-addressed MarketDataSnapshot prepared before a later bundle failure may persist as independent evidence; no Entity/Arena bundle objects or their mutation AuditEvents partially commit. Successful Apply adds `IMPORT_APPLIED` and all import-driven domain events share one correlation ID.

## D-042 — PLPS schema discovery and compatibility
Strict PLPS validation is paired with machine-readable `/api/import/schema` discovery backed by canonical runtime definitions/defaults. Once PLPS v1 ships, its decoder is never removed; permanent v1 fixtures are standing compatibility tests. V1 input is paste-only. Portable Export, file loading, compressed share strings, arbitrary existing-object bundle matching, and Evolution configuration are follow-up capabilities rather than requirements of the initial Portable Research milestone.

## D-043 — Arena authoring focus and Experience result export
Arena creation is an explicit workspace mode opened by the `+` action beside Arena Import; the ordinary Arenas workspace is reserved for immutable Arena and Experience browsing rather than permanently displaying an authoring form. Cancelling or completing creation returns to the normal Arenas/Experiences workspace, and successful creation selects the new Arena. Completed Experience scientific evidence may be exported as a read-only `paper-lab-experience-result` JSON artifact containing the immutable Experience, ExperienceEvents, and ExperienceTrace. Experience result export is not PLPS configuration and is not an Import/restore mechanism.

## D-044 — Portable Import is a right-side utility panel
Portable Import uses the same right-side utility-panel interaction model as Notification History: full height below the application header, responsive width, toggle/close/Escape/outside-click dismissal, and mutual exclusion with Notifications. Object-panel Import controls use the same standard control height as adjacent + buttons. Import planning/domain semantics are unchanged.
