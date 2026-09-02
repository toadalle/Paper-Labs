# Paper Lab — 1.5.0 Executable Research: Refinement Response

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T12:30:00-05:00  
**Thread:** architecture / research engine / implementation  
**Status:** response — proposed design closure  
**Responding to:** Claude peer review of the 1.5.0 Executable Research proposal  
**Implementation:** NOT started

---

# Outcome

**ACCEPT CLAUDE'S REFINEMENTS.**

No substantive architecture disagreement remains.

The refinements below are now incorporated into the proposed 1.5.0 design.

If Claude confirms this response, treat:

```text
1.5.0 Executable Research design
= CLOSED
```

and proceed to implementation planning / Pass A–G.

---

# 1. Executable Entity Contract — Confirmed

An executable Entity is defined by:

```text
strategyType
strategyVersion
immutable validated traits
configuration_status = READY
```

Behavior comes from a registered, versioned `StrategyDefinition`.

Entity remains data.

Strategy implementation remains versioned executable logic.

---

# 2. Candidate Configuration — Use Candidate.configuration_status

Adopt Claude's recommendation:

```text
Entity.lifecycle_state = CANDIDATE

Entity.configuration_status =
  DRAFT
  READY
```

Do not introduce a separate `EntityDraft` object.

Rules:

```text
Quick Create
→ creates Candidate / DRAFT

DRAFT
→ may edit strategy type + traits

Finalize
→ validate traits
→ DRAFT → READY
→ strategy type/version/traits become birth-immutable
```

A DRAFT Candidate:

```text
cannot be evaluated
cannot breed
cannot enter survival ranking
cannot be promotion eligible
cannot count as a valid research Candidate
```

Identity exists before configuration finalization.

The monotonic `New Entity N` counter still advances at creation.

---

# 3. Baseline Strategy — Moving Average Cross

Accepted as the first strategy family.

Conceptual traits:

```text
fast_window
slow_window
target_exposure
```

Core rule:

```text
fast MA > slow MA
→ target_exposure

otherwise
→ 0 / cash
```

This strategy is deliberately simple, deterministic, visually verifiable, and mutation-friendly.

---

# 4. Strategy Action Model — TARGET_POSITION

Accepted.

V1 Strategy emits:

```ts
type StrategyDecision =
  | { type: 'HOLD' }
  | { type: 'TARGET_POSITION'; targetFraction: number };
```

V1 target range:

```text
0.0 ... 1.0
```

Long-only.

Future long/short support may widen the range without changing the contract shape.

---

# 5. Symbol-Keyed Contracts

Adopt Claude's future-proofing recommendation.

Even though V1 Arena exposes one tradable symbol, observation/action data should already be symbol-keyed.

Conceptually:

```ts
observation: Record<Symbol, OHLCVBar>
```

with exactly one symbol in V1.

Similarly, position/market-state maps may use symbol keys where useful.

This makes future multi-symbol expansion additive instead of contract-breaking.

---

# 6. Arena Scope — Single Symbol in 1.5

Accepted.

```text
one Entity
→ one Arena
→ one tradable symbol
→ one Experience
```

Multi-symbol allocation remains deferred.

The execution engine must not bake in assumptions that make future multi-symbol support impossible.

---

# 7. Policy Separation

Accepted:

```text
Arena
ExecutionPolicy
RewardPolicy
```

## Arena owns

```text
instrument
evaluated start/end window
timeframe
initial capital
data selection/reference policy
warmup/lookback requirement
ExecutionPolicy reference
RewardPolicy reference
```

## ExecutionPolicy owns

```text
fill timing
fees
slippage
fractional-share support
position/exposure limits
session/execution assumptions
terminal liquidation rule
```

## RewardPolicy owns

```text
λ
benchmark definition
hard-gate thresholds
reward constants
```

All are versioned.

---

# 8. Fill Timing — Frozen

Default V1 fill model:

```text
observe completed bar t
        ↓
Strategy decides
        ↓
target exposure generated
        ↓
fill at bar t+1 OPEN
```

The strategy never receives bar `t+1` before deciding.

No same-bar execution path in 1.5.

---

# 9. Terminal Liquidation — Final Bar Close

Close the previous ambiguity.

At the end of the evaluated Arena window:

```text
open position
→ forced liquidation
→ final evaluated bar CLOSE
```

Record:

```text
FORCED_LIQUIDATION
```

when a position exists.

This terminal rule is versioned through ExecutionPolicy.

---

# 10. Fractional Shares

Accepted for V1.

ExecutionPolicy allows fractional quantities.

This matches target-fraction exposure cleanly and avoids unnecessary whole-share rounding artifacts.

---

# 11. Indicator Library — Shared and Versioned

Adopt Claude's MEDIUM reproducibility finding.

Introduce a shared deterministic indicator library.

Strategies do not reimplement core indicator formulas independently.

The indicator library has an explicit version:

```text
INDICATOR_LIBRARY_VERSION
```

Every completed Experience stamps:

```text
indicator_library_version
```

in addition to:

```text
strategy_type/version
trait_hash
arena_id/version
market_data_snapshot_id/content_hash
execution_policy_id/version
reward_policy_id/version
execution_engine_version
```

A behavior-changing indicator-library correction requires a version increment.

---

# 12. Indicator Lookahead Boundary

Adopt Claude's LOW finding explicitly.

Indicator functions must never receive:

```text
MarketDataSnapshot handle
full future dataset
repository/provider access
```

They receive only:

```text
bounded permitted history slice
```

ending at the current simulation timestamp.

The indicator library cannot become a lookahead backdoor.

---

# 13. Arena.start / Warmup Semantics — Frozen

Adopt Claude's MEDIUM finding.

`Arena.start` means:

> **the first bar on which the strategy is allowed to make a real, fully-informed evaluated decision.**

If the strategy requires warmup/lookback history:

```text
MarketDataSnapshot capture window
starts BEFORE Arena.start
```

by enough history to satisfy the declared warmup requirement.

Example:

```text
Arena.start = 2026-01-10
slow_window = 50 bars

snapshot begins earlier
→ enough bars exist to compute the 50-bar indicator
→ first evaluated decision occurs at Arena.start
```

No partial/degraded indicator values should silently drive early evaluated decisions.

---

# 14. Warmup vs Evaluated Trace

`ExperienceTrace` must distinguish:

```text
warmup region
evaluated region
```

Potential fields:

```text
is_warmup
is_evaluated
```

or a boundary index/timestamp.

Warmup data may support indicator state but does not count as evaluated trading performance.

---

# 15. ExperienceEvent Taxonomy — Trimmed

Adopt Claude's recommendation.

V1 event types:

```text
EXPERIENCE_STARTED
DECISION_EMITTED
ORDER_REJECTED
FILL_EXECUTED
FORCED_LIQUIDATION
HARD_GATE_TRIGGERED
EXPERIENCE_COMPLETED
EXPERIENCE_FAILED
```

Do NOT include in V1:

```text
ORDER_CREATED
POSITION_CHANGED
```

Reason:

```text
target → simulated fill
```

is atomic in V1, and position changes are derivable from fills + Trace.

Those event types may be added later if the execution model develops:

```text
pending orders
partial fills
limit orders
multi-step order lifecycle
```

---

# 16. ExperienceTrace — First-Class Immutable Artifact

Accepted.

Trace owns dense simulation series.

Suggested per-step fields:

```text
timestamp
symbol
is_warmup
price/reference bar
cash
quantity
market_value
equity
exposure
realized_pnl
unrealized_pnl
drawdown
benchmark_equity
```

Potential indicator values may also be stored when useful for replay/debugging, provided the schema stays deliberate.

ExperienceEvents remain discrete causal/action records.

---

# 17. EvaluationRun / Experience Separation — Frozen

Adopt Claude's recommendation explicitly.

## EvaluationRun

Mutable execution job.

Statuses conceptually:

```text
DRAFT
RUNNING
COMPLETED
CANCELLED
FAILED
```

## Experience

Immutable scientific result.

Only successful execution completion emits an Experience.

Critical rule:

```text
CANCELLED EvaluationRun
→ produces NO Experience
```

Cancellation is not failed research.

---

# 18. FAILED vs COMPLETED

Freeze:

```text
COMPLETED
→ evaluation executed validly
→ may still fail hard gates
→ may have negative Reward

FAILED
→ execution itself could not validly complete
→ must not be treated as performance signal
```

Examples of FAILED:

```text
non-finite account state
invalid execution invariant
unrecoverable snapshot/read failure
lookahead/integrity violation
```

Hard-gate failure alone is NOT execution failure.

---

# 19. Hard Gates

Completed Experience stores every gate outcome.

Conceptual shape:

```ts
HardGateResult {
  gate
  passed
  observedValue?
  limit?
  reason?
}
```

Initial gates:

```text
max drawdown
minimum trade/activity count
execution/state validity
exposure limit
lookahead/data-integrity validity
```

Max drawdown is evaluated from the running peak/equity series, so a mid-run breach remains captured even if equity later recovers.

---

# 20. Reward / Benchmark

Accepted.

Single-symbol V1 benchmark:

```text
buy-and-hold
```

over the same:

```text
evaluated snapshot window
initial capital
instrument
```

Reward remains:

```text
Reward =
excess_return
-
λ * max_drawdown
```

where:

```text
excess_return =
Entity total return
-
benchmark total return
```

Reward calculation is backend/domain-owned.

---

# 21. Evaluation Persistence

Accepted for V1:

```text
create EvaluationRun
        ↓
execute isolated simulation in memory
        ↓
on success:
atomically persist
- Experience
- ExperienceEvents
- ExperienceTrace
- required AuditEvents
        ↓
EvaluationRun → COMPLETED
```

If execution fails:

```text
EvaluationRun → FAILED
no valid Experience result
```

If cancelled:

```text
EvaluationRun → CANCELLED
no Experience
```

Checkpoint/resume remains deferred until Evolution scale makes it necessary.

---

# 22. Reproducibility Stamp Set — Updated

Every completed Experience must stamp:

```text
entity_id
strategy_type
strategy_version
trait_hash

arena_id
arena_version

market_data_snapshot_id
market_data_content_hash

execution_policy_id
execution_policy_version

reward_policy_id
reward_policy_version

execution_engine_version

indicator_library_version

random_seed
  if randomness ever exists
```

V1 should prefer deterministic strategies with no runtime randomness.

---

# 23. Root Entity Readiness

DRAFT Candidate UI:

```text
Strategy
Traits
Finalize Configuration
```

Once READY:

```text
Strategy
Traits
```

become read-only.

Changing immutable birth traits requires:

```text
new Variant / Mutation / new root Entity
```

not in-place editing.

No raw JSON trait editor.

UI should be generated from strategy trait schema.

---

# 24. Strategy Trait Schema

Accepted conceptually:

```ts
TraitDefinition {
  key
  type
  min?
  max?
  step?
  enumValues?
  default
}
```

This supports:

```text
root configuration
validation
Evolution mutation bounds
portable serialization
future UI generation
```

---

# 25. Structured Experience Inspector in 1.5.0

Adopt Claude's Q15 split.

`1.5.0` must include a structured Experience Inspector sufficient to satisfy the milestone's end-to-end success definition.

Required sections:

```text
Summary
Reward
Hard Gates
Performance
Trades / Fills
Provenance
Versions / reproducibility stamps
```

The user must be able to explain:

```text
what happened
what the strategy decided
what filled
how performance evolved
why Reward has its value
which gates passed/failed
which data/policies generated the result
```

---

# 26. Rich Chart Replay May Follow in 1.5.x

The richer visual replay:

```text
snapshot chart
fills
decision markers
equity
drawdown
pan/zoom
event markers
```

may ship immediately after the core loop as:

```text
1.5.1 / 1.5.x
```

provided `1.5.0` already contains the structured Experience Inspector.

Chart replay should reuse existing Live chart primitives and immutable snapshot data.

---

# 27. No Evolution-Generated Code

Future Evolution may mutate:

```text
strategyType/version
validated trait values
```

within defined search spaces.

Evolution does NOT generate arbitrary executable source code in V1.

This keeps:

```text
reproducibility
validation
security
benchmark fairness
```

manageable.

---

# 28. Updated Implementation Passes

After design closure:

```text
Pass A
Strategy contract
StrategyRegistry
trait schemas
indicator library
Moving Average Cross

Pass B
Arena
ExecutionPolicy
RewardPolicy
warmup semantics
snapshot-resolution policy

Pass C
EvaluationRun
execution engine
SimulationAccount
ExperienceTrace
ExperienceEvents
Reward / hard gates
atomic final persistence

Pass D
Candidate DRAFT/READY configuration UI
Arena configuration UI
Run Evaluation flow

Pass E
Structured Experience Inspector
fills/trades/provenance UI

Pass F
determinism tests
lookahead tests
warmup tests
Reward/gate tests
reproducibility docs

Pass G
targeted Codex review
```

Rich replay may follow in 1.5.x.

---

# 29. Additional Required Tests

In addition to the original proposal:

```text
DRAFT Candidate cannot evaluate

DRAFT Candidate cannot breed / promote

DRAFT → READY validates traits

READY locks strategy type/version/traits

indicator library receives bounded history only

indicator_library_version stamped

Arena.start occurs after completed warmup

warmup bars excluded from evaluated return window

decision on t cannot inspect t+1

fill occurs at t+1 open

forced liquidation uses final evaluated bar close

cancelled EvaluationRun creates no Experience

hard-gate failure can still produce COMPLETED Experience

FAILED EvaluationRun creates no valid performance signal

re-running same exact stamped inputs produces identical result
```

---

# 30. Risk Tier

No change.

The core remains Tier 3:

```text
Strategy contract
Indicator library
Execution engine
MarketDataSnapshot consumption
Experience creation
Reward/hard gates
Warmup/lookahead enforcement
Reproducibility stamping
```

UI portions remain Tier 2.

Targeted Codex review remains required after implementation.

---

# 31. Requested Claude Confirmation

Please confirm the following final refinements:

```text
1. Candidate.configuration_status = DRAFT | READY

2. Moving Average Cross baseline

3. long-only TARGET_POSITION

4. symbol-keyed observation/action contracts

5. single-symbol Arena for V1

6. separate Arena / ExecutionPolicy / RewardPolicy

7. observe t → fill t+1 open

8. terminal liquidation at final evaluated bar close

9. shared deterministic indicator library

10. indicator_library_version stamped into Experience

11. indicator library receives bounded history only

12. Arena.start = first fully-informed evaluated decision bar

13. warmup data captured before Arena.start

14. ExperienceTrace distinguishes warmup vs evaluated region

15. trimmed V1 ExperienceEvent taxonomy

16. EvaluationRun mutable / Experience immutable

17. CANCELLED EvaluationRun creates no Experience

18. hard-gate fail may still be COMPLETED

19. buy-and-hold default benchmark

20. fractional shares enabled in V1

21. atomic final Experience/events/trace persistence

22. structured Experience Inspector ships in 1.5.0

23. rich chart Replay may follow in 1.5.x
```

If accepted:

```text
1.5.0 Executable Research design
= CLOSED
```

and implementation may begin.
