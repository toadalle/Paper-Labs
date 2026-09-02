# Paper Lab — 1.5.0 Executable Research Implementation Plan

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T12:42:20-05:00  
**Thread:** implementation / research engine / frontend / persistence  
**Status:** implementation plan — architecture CLOSED  
**Baseline:** `paper_labs_1.4.0.zip`  
**Target:** `paper_labs_1.5.0.zip`

---

# 1. Milestone Objective

`1.5.0` is the first complete executable-research milestone.

The milestone is done only when Paper Lab can execute the following end-to-end loop:

```text
Candidate / READY Entity
        ↓
immutable Strategy + Traits
        ↓
versioned Arena
        ↓
EvaluationRun
        ↓
Execution Engine
        ↓
immutable Experience
        ↓
ExperienceEvents + ExperienceTrace
        ↓
Reward + Hard Gates
        ↓
structured Experience Inspector
```

The user must be able to answer, from the application:

```text
What did this Entity do?
Why did it do it?
What filled?
How did account state evolve?
What was the benchmark?
Why did Reward have this value?
Which hard gates passed or failed?
Which exact data, strategy, policies, and engine versions produced the result?
```

---

# 2. Design Status

The 1.5.0 Executable Research architecture is **CLOSED**.

Claude accepted all final design items.

No implementation pass may silently reopen settled architecture.

If implementation exposes a genuine contradiction or missing invariant:

```text
stop that affected pass
document the ambiguity
return to GPT ↔ Claude design review
```

Do not guess through Tier-3 ambiguity.

---

# 3. Frozen Design Summary

## Entity readiness

```text
Entity.lifecycle_state = CANDIDATE

Entity.configuration_status =
  DRAFT
  READY
```

DRAFT:

```text
editable strategy type/version/traits
cannot evaluate
cannot breed
cannot rank for survival
cannot promote
```

READY:

```text
validated immutable birth traits
eligible for evaluation subject to ordinary gates
```

---

## Strategy identity

```text
strategyType
strategyVersion
immutable validated traits
```

Behavior comes from:

```text
StrategyRegistry
→ StrategyDefinition
```

V1 baseline:

```text
Moving Average Cross
```

---

## Strategy action

```text
HOLD
TARGET_POSITION
```

V1 target exposure:

```text
0.0 ... 1.0
```

Long-only.

---

## Arena

V1:

```text
single tradable symbol
```

but contracts are symbol-keyed.

Arena references separate versioned:

```text
ExecutionPolicy
RewardPolicy
```

---

## Fill model

```text
observe completed bar t
→ decide
→ fill at bar t+1 OPEN
```

No same-bar execution.

---

## Warmup

```text
Arena.start
= first fully-informed evaluated decision bar
```

Market-data capture begins earlier when warmup is required.

Warmup bars:

```text
support indicators
do not count toward evaluated return
are explicitly distinguished in ExperienceTrace
```

---

## Terminal liquidation

```text
open terminal position
→ forced liquidation
→ final evaluated bar CLOSE
```

---

## EvaluationRun / Experience

```text
EvaluationRun
= mutable execution job

Experience
= immutable scientific result
```

Cancellation:

```text
CANCELLED EvaluationRun
→ no Experience
```

Execution failure:

```text
FAILED EvaluationRun
→ no valid Experience
```

Successful execution:

```text
COMPLETED EvaluationRun
→ immutable Experience
```

Hard-gate failure may still exist on a valid completed Experience.

---

## Dense vs discrete evidence

```text
ExperienceTrace
→ dense time-series state

ExperienceEvent
→ discrete causal/state-transition events
```

V1 ExperienceEvent types:

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

---

## Reproducibility stamps

Every Experience stamps:

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

random_seed if randomness ever exists
```

---

# 4. Implementation Philosophy

This milestone must be built as a **research system**, not as a demonstration.

Each pass must leave behind:

```text
domain invariants
application boundaries
tests
documentation
clear provenance
```

Avoid:

```text
frontend-computed business formulas
strategy-specific execution hacks
raw JSON configuration UI
repository access from strategies
full snapshot access from indicators
mutable Experience results
silent fallbacks
implicit lookahead
```

---

# 5. Pass A — Strategy Contract + Indicator Library

## Goal

Make Entity behavior executable and versioned without yet running an Arena.

## Deliverables

### Domain

Introduce:

```text
StrategyDefinition
StrategyRegistry
StrategyDecision
StrategyStepInput
StrategyInitContext
StrategyState boundary
TraitDefinition
Trait validation
```

Add Entity fields:

```text
configuration_status
strategy_type
strategy_version
traits
trait_hash
```

Ensure existing Entity persistence/migrations are updated cleanly.

---

## Candidate configuration state

Quick Create:

```text
Candidate
configuration_status = DRAFT
```

Finalize:

```text
validate strategy
validate traits
compute trait hash
lock strategy type/version/traits
DRAFT → READY
```

No transition back to DRAFT.

---

## Moving Average Cross

Implement exactly one baseline strategy.

Suggested trait schema:

```text
fast_window
  integer
  minimum >= 1

slow_window
  integer
  slow_window > fast_window

target_exposure
  decimal
  0.0 ... 1.0
```

No hidden defaults after READY.

Any defaults belong in explicit trait-schema metadata used during DRAFT configuration.

---

## Shared indicator library

Implement versioned deterministic indicator library.

Minimum required indicator:

```text
simple moving average
```

Interface receives:

```text
bounded permitted series/slice
```

Never:

```text
MarketDataSnapshot object
provider
database
repository
future bars
```

Expose:

```text
INDICATOR_LIBRARY_VERSION
```

---

## Pass A tests

Required:

```text
Quick Create produces DRAFT Candidate

DRAFT strategy fields editable

invalid strategy type rejected

invalid trait shape rejected

fast_window >= slow_window rejected

target_exposure outside 0...1 rejected

DRAFT → READY succeeds with valid traits

READY strategy type immutable

READY strategy version immutable

READY traits immutable

READY trait hash deterministic

Moving Average Cross decision deterministic

indicator SMA deterministic

indicator library cannot consume unrestricted snapshot/provider handles

DRAFT Candidate cannot pass evaluation eligibility
```

---

## Pass A acceptance gate

No Arena execution yet.

We must be able to inspect one Entity and prove:

```text
identity exists
strategy exists
traits validate
traits lock at READY
strategy decision works on bounded synthetic observations
```

---

# 6. Pass B — Arena + ExecutionPolicy + RewardPolicy

## Goal

Define immutable versioned evaluation conditions before building the engine.

## Arena model

Arena version should represent:

```text
name
symbol
timeframe

Arena.start
Arena.end

initial_capital

warmup/lookback requirement

MarketDataSnapshot selection/reference policy

execution_policy_id/version
reward_policy_id/version
```

Once an Arena version has been used:

```text
immutable
```

Changes create a new version.

---

## ExecutionPolicy V1

Versioned fields:

```text
fill_model = NEXT_BAR_OPEN
terminal_liquidation = FINAL_BAR_CLOSE

fractional_shares = true

commission model
slippage model

max exposure = 1.0
long_only = true

session/execution assumptions
```

Keep market-impact complexity out of V1.

---

## RewardPolicy V1

Versioned:

```text
lambda_drawdown_penalty

benchmark = BUY_AND_HOLD

max_drawdown_gate
minimum_activity_gate
max_exposure_gate
execution_validity_gate
data_integrity_gate
```

Reward:

```text
excess_return
-
lambda * max_drawdown
```

---

## Warmup contract

Resolve required history before evaluated start.

Conceptually:

```text
capture_start < Arena.start
evaluated_start = Arena.start
evaluated_end = Arena.end
```

The exact number of required warmup bars should derive from:

```text
strategy requirements
+
Arena/policy requirement if any
```

For Moving Average Cross:

```text
minimum warmup >= slow_window
```

Define whether one extra bar is required by indicator semantics and test it explicitly.

No off-by-one ambiguity may survive Pass B.

---

## Pass B tests

```text
Arena version creation works

used Arena version immutable

new configuration creates new version

ExecutionPolicy version identity stable

RewardPolicy version identity stable

NEXT_BAR_OPEN encoded explicitly

FINAL_BAR_CLOSE encoded explicitly

long-only exposure encoded explicitly

fractional-share behavior encoded explicitly

warmup requirement deterministic from strategy traits

Arena.start never silently moves because of warmup

capture window extends backward instead
```

---

## Pass B acceptance gate

Given:

```text
READY Entity
Arena
```

the application/domain can resolve every static execution/reward condition needed for a run before the engine starts.

---

# 7. Pass C — EvaluationRun + Execution Engine + Experience

## Goal

Build the Tier-3 scientific core.

This is the most important pass in the milestone.

---

# 8. EvaluationRun

Introduce mutable job state.

Suggested shape:

```text
id
entity_id
arena_id/version

status:
  DRAFT
  RUNNING
  COMPLETED
  CANCELLED
  FAILED

created_at
started_at
completed_at
cancelled_at
failed_at

failure_code?
failure_message?
```

No performance metrics belong here as authoritative scientific results.

---

# 9. Market Data Resolution

Evaluation must consume:

```text
immutable MarketDataSnapshot
```

Never Live provider output directly.

Before execution:

```text
resolve snapshot
verify provenance
verify hash/integrity
verify coverage:
  warmup start
  Arena.start
  Arena.end
```

If required evaluated/warmup data is missing:

```text
EvaluationRun FAILED
no Experience
```

No silent shortening of the evaluated window.

---

# 10. Execution Engine Version

Introduce:

```text
EXECUTION_ENGINE_VERSION
```

Every Experience stamps it.

Any behavior-changing change to:

```text
decision timing
fill sequencing
accounting
fees
slippage
terminal liquidation
trace semantics
```

requires an engine-version increment.

---

# 11. Simulation Isolation

Every run owns isolated in-memory:

```text
Strategy state
SimulationAccount
current position state
trace buffer
event buffer
hard-gate observations
benchmark state
```

No mutable state shared between concurrent EvaluationRuns.

---

# 12. SimulationAccount V1

Minimum:

```text
cash
quantity
average_entry_price

market_value
equity

realized_pnl
unrealized_pnl

peak_equity
max_drawdown
```

Use exact/appropriate numeric representation consistently.

Avoid accidental floating-point drift if current project standards already define decimal handling.

---

# 13. Execution Ordering

For each evaluated decision step:

```text
1. expose only permitted history through bar t

2. compute indicators from bounded history

3. build symbol-keyed observation

4. Strategy.decide()

5. append DECISION_EMITTED

6. validate decision

7. on next bar:
   calculate target quantity
   apply fees/slippage
   validate constraints
   execute fill

8. append FILL_EXECUTED
   or ORDER_REJECTED

9. update SimulationAccount

10. update running drawdown / benchmark

11. append ExperienceTrace point
```

Exact event/trace timestamp semantics must be tested.

---

# 14. Decision Validation

Reject invalid Strategy output:

```text
non-finite targetFraction
targetFraction < 0
targetFraction > 1
unknown symbol
invalid action shape
```

Whether invalid Strategy output:

```text
fails EvaluationRun
```

or produces a rejected order but keeps running must be explicit.

Recommended V1:

```text
malformed/non-finite StrategyDecision
→ FAILED EvaluationRun

valid decision violating an execution constraint
→ ORDER_REJECTED
→ run may continue
```

This distinction should be documented.

---

# 15. Fees and Slippage

ExecutionPolicy applies deterministic transformations.

Conceptually:

```text
reference next-bar open
→ slippage-adjusted execution price
→ commission/fee
→ quantity
→ cash/equity update
```

All formulas backend-owned and unit-tested.

---

# 16. ExperienceTrace

First-class immutable result artifact.

Suggested evaluated trace fields:

```text
timestamp
symbol

is_warmup
is_evaluated

open
high
low
close
volume

cash
quantity

market_value
equity
exposure

realized_pnl
unrealized_pnl

drawdown
benchmark_equity

decision_target?
fill_quantity?
fill_price?

baseline strategy indicator values:
  fast_ma?
  slow_ma?
```

Do not duplicate fields solely because they are convenient for frontend rendering.

Store only what materially improves:

```text
reproducibility
explanation
replay
debugging
```

---

# 17. Warmup Trace

Warmup points:

```text
is_warmup = true
is_evaluated = false
```

No evaluated trades occur during warmup.

Warmup may initialize:

```text
indicator availability
strategy state
```

but performance begins at Arena.start.

---

# 18. Benchmark

V1:

```text
buy-and-hold
```

Benchmark begins at the same evaluated start and capital basis.

Warmup does not produce benchmark performance.

Benchmark trace must align temporally with evaluated trace.

---

# 19. Terminal Liquidation

At final evaluated bar:

```text
if quantity > 0
→ execute forced liquidation at final bar CLOSE
→ append FORCED_LIQUIDATION
```

Apply configured transaction cost policy consistently.

Terminal liquidation affects:

```text
ending equity
realized PnL
total return
reward
```

---

# 20. Hard Gates

Compute/store each result independently.

Initial:

```text
max drawdown
minimum activity/trade count
exposure maximum
execution validity
data integrity / no-lookahead validity
```

A valid execution with failed gates:

```text
Experience exists
EvaluationRun COMPLETED
Reward recorded
gate result passed=false
```

Do not convert ordinary gate failure into `FAILED`.

---

# 21. Experience

Immutable scientific result.

Minimum result data:

```text
id
entity_id

starting_capital
ending_equity

total_return
benchmark_return
excess_return

max_drawdown
trade_count

reward

hard_gate_results

research_validity

all reproducibility stamps
```

Once committed:

```text
immutable
```

except any already-established narrow research-validity terminal transition if still architecturally applicable.

---

# 22. Atomic Final Commit

Execution runs in isolated memory.

On successful completion:

```text
BEGIN

persist immutable Experience
persist ExperienceEvents
persist ExperienceTrace
persist required AuditEvents

mark EvaluationRun COMPLETED

COMMIT
```

If any scientific result write fails:

```text
ROLLBACK
```

No partial Experience.

Failure should leave:

```text
EvaluationRun FAILED
```

through a safe separate status transition if necessary.

---

# 23. Cancellation

If user cancels while RUNNING:

```text
EvaluationRun → CANCELLED
```

and:

```text
no Experience
no ExperienceTrace
no ExperienceEvent scientific result set
```

Operational logs may still exist.

Audit cancellation if existing audit policy considers it a material state transition.

---

# 24. Pass C tests — Determinism

Critical:

```text
same Entity
same Arena
same snapshot
same policies
same engine version
same indicator version

→ byte/logically identical scientific result
```

Allow IDs/timestamps that are intentionally unique to differ, but scientific outputs must match exactly.

Prefer a canonical scientific-result hash for test comparison if appropriate.

---

# 25. Pass C tests — Lookahead

Required adversarial tests:

```text
strategy at t cannot inspect t+1

indicator library cannot inspect t+1

changing future bars beyond t does not change decision at t

warmup history may influence first evaluated decision

bars before required warmup boundary cannot leak arbitrary future/evaluated state
```

---

# 26. Pass C tests — Accounting

```text
cash updates correctly

fractional quantity correct

target 0 liquidates ordinary position at next open

target 1 allocates within policy

fees applied once

slippage applied once

equity equation holds

drawdown running peak correct

terminal liquidation at final close correct

benchmark return correct
```

---

# 27. Pass C tests — Status

```text
cancelled → no Experience

invalid snapshot → FAILED, no Experience

malformed strategy decision → FAILED

valid but losing strategy → COMPLETED

hard-gate failure → COMPLETED

negative Reward → COMPLETED
```

---

# 28. Pass C acceptance gate

Before frontend work depends on it, we must be able to execute a deterministic test fixture entirely through domain/application services and produce:

```text
EvaluationRun COMPLETED
Experience
ExperienceEvents
ExperienceTrace
Reward
HardGateResults
reproducibility stamps
```

with tests proving no lookahead.

---

# 29. Pass D — Entity Configuration + Arena UI + Run Flow

## Goal

Expose the executable backend without weakening domain rules.

---

# 30. Entity Inspector — DRAFT

Show:

```text
Configuration status: DRAFT

Strategy
  Moving Average Cross

Traits
  Fast Window
  Slow Window
  Target Exposure

Finalize Configuration
```

Trait inputs generated from Strategy trait schema.

No raw JSON.

---

# 31. Entity Inspector — READY

Show immutable:

```text
Strategy type
Strategy version
Traits
Trait hash
Configuration status: READY
```

No editable controls for birth traits.

Normal Entity lifecycle actions remain.

---

# 32. Entity table

Add configuration status where useful without destroying table density.

Potential:

```text
Config
DRAFT / READY
```

Support ordinary filtering if consistent with existing filter infrastructure.

Do not overload lifecycle with readiness.

---

# 33. Arena Workspace

Support:

```text
Arena list/version list

create Arena
configure:
  symbol
  timeframe
  evaluated start/end
  initial capital
  ExecutionPolicy
  RewardPolicy

inspect version
```

Once used:

```text
read-only
```

Creating modified configuration produces a new version.

---

# 34. Run Evaluation

Available only when:

```text
Entity READY
Arena valid
required market data resolvable
```

Flow:

```text
Evaluate
→ select Arena version if not already in Arena context
→ create EvaluationRun
→ run
```

No destructive confirmation modal.

Show explicit run state.

---

# 35. Evaluation status UI

Minimum:

```text
Queued/Draft if relevant
Running
Completed
Cancelled
Failed
```

If runs are synchronous/fast initially, still maintain correct backend EvaluationRun semantics.

Do not fake status solely in frontend.

---

# 36. Pass D tests

```text
DRAFT UI editable

READY UI read-only

Finalize calls backend validation

failed finalize retains DRAFT

DRAFT Evaluate disabled with reason

READY Evaluate available

Arena used version cannot edit

Arena new version flow works

run creates EvaluationRun

cancel invokes real backend cancellation if run duration permits
```

---

# 37. Pass E — Structured Experience Inspector

## Goal

Make completed research understandable without requiring rich chart Replay yet.

---

# 38. Experience list/workspace

Provide a discoverable route/surface for Experiences.

Potential placement must remain consistent with current Objects / Workspace / Inspector shell.

Do not introduce a modal-centric Experience browser.

---

# 39. Required Inspector sections

```text
Summary
Performance
Reward
Hard Gates
Fills
Strategy / Traits
Arena
Market Data Provenance
Execution Policy
Reward Policy
Versions
Research Validity
```

---

# 40. Summary

Show:

```text
Entity
Arena
symbol
timeframe
evaluated start/end

starting capital
ending equity

total return
benchmark return
excess return

max drawdown
trade count
Reward
```

---

# 41. Reward explanation

Frontend displays backend-produced components.

Example conceptual presentation:

```text
Excess return        +0.084
Drawdown penalty     -0.021
Reward                0.063
```

No frontend recomputation.

---

# 42. Hard Gates

Show every gate:

```text
PASS / FAIL
observed value
limit
reason
```

A failed gate must be visually obvious without implying the Experience itself failed to execute.

---

# 43. Fills

Structured table:

```text
timestamp
symbol
side/effect
quantity
reference price
execution price
fees
resulting exposure
```

Derive display-only concepts backend-side if required by the frontend no-business-formula rule.

---

# 44. Provenance

Show exact:

```text
MarketDataSnapshot ID
content hash

Arena ID/version

ExecutionPolicy ID/version
RewardPolicy ID/version

strategy type/version
trait hash

execution engine version
indicator library version
```

This is a first-class research feature, not hidden diagnostics.

---

# 45. Pass E tests

```text
Experience route loads

all backend metrics render without recomputation

gate failure displays as gate failure, not execution failure

provenance stamps visible

fills table handles zero trades honestly

long identifiers do not break responsive Inspector

narrow-mode surface switching remains accessible
```

---

# 46. Pass F — Documentation + Research Validation

## Architecture documentation

Add canonical docs for:

```text
Strategy Contract
Indicator Library
Candidate DRAFT/READY
Arena Execution Model
ExecutionPolicy
RewardPolicy
EvaluationRun
Experience
ExperienceTrace
Lookahead Prevention
Warmup Semantics
Reproducibility Stamps
```

---

# 47. Decision log

Add decision entries for every newly frozen implementation invariant.

Do not leave accepted decisions only in collaboration handoffs.

Expected decisions include:

```text
DRAFT/READY
Moving Average Cross baseline
TARGET_POSITION
single-symbol V1
next-bar-open fills
final-close liquidation
fractional shares
ExperienceTrace split
EvaluationRun/Experience separation
indicator version stamp
Arena.start warmup semantics
```

---

# 48. Architecture amendment

Because 1.5 introduces major research-engine semantics, create a dedicated architecture amendment rather than burying the executable contract solely in implementation notes.

Likely:

```text
ARCHITECTURE-AMENDMENT-004
Executable Research Contract
```

Number must follow actual repository sequence.

---

# 49. Research fixture

Create one canonical deterministic fixture.

Example:

```text
symbol: synthetic TEST
known OHLCV bars
known Moving Average Cross traits
known expected decisions
known expected fills
known expected equity
known expected Reward
known gate outcomes
```

This fixture becomes the golden execution-engine regression case.

No network/provider dependency.

---

# 50. Reproducibility test

Run canonical fixture twice.

Compare canonical scientific output.

Required equality:

```text
decision sequence
fill sequence
trace scientific values
performance metrics
Reward
gate outcomes
version stamps
```

---

# 51. Market-data integrity tests

Verify:

```text
snapshot hash mismatch
→ execution rejected / research invalid

missing required warmup
→ failed run

missing evaluated bar
→ failed run

out-of-order bars
→ rejected unless normalization contract guarantees ordering beforehand

duplicate timestamps
→ deterministic explicit handling
```

---

# 52. Frontend regression

Run all existing frontend-makeover regression tests:

```text
responsive shell
surface selector
Entities filtering
Notification manager
toast behavior
Live watchlist
context menus
Console
```

1.5 must not destabilize the now-closed 1.3 frontend milestone.

---

# 53. Pass F acceptance gate

Before review:

```text
full check suite PASS
build PASS
runtime smoke PASS
canonical research fixture PASS
determinism PASS
lookahead adversarial tests PASS
manifest PASS
docs/code alignment PASS
```

---

# 54. Pass G — Targeted Tier-3 Review

## Reviewer

Claude is the standing manager/reviewer in this project workflow.

The closed design text says "Codex review"; under the user's current collaboration model, Claude should perform the targeted manager/Tier-3 review unless the user explicitly directs a different reviewer/tool.

Do not self-initiate code takeover.

---

# 55. Required review scope

Provide Claude:

```text
paper_labs_1.5.0.zip
implementation handoff
architecture amendment
manifest
relevant test summary
```

Ask Claude to directly inspect:

```text
StrategyDefinition / StrategyRegistry
trait immutability
indicator bounded-history interface
warmup handling
next-bar-open sequencing
SimulationAccount accounting
fees/slippage
terminal liquidation
ExperienceTrace
ExperienceEvents
Reward
hard gates
EvaluationRun statuses
atomic final persistence
reproducibility stamps
frontend/business-formula boundary
```

---

# 56. Required adversarial review questions

Claude should specifically attempt to find:

```text
lookahead path

off-by-one warmup bug

decision/fill timestamp mismatch

same-bar accidental execution

double fee/slippage application

incorrect terminal liquidation

benchmark period mismatch

hard-gate vs FAILED confusion

CANCELLED producing scientific evidence

mutable Experience fields

missing reproducibility stamp

indicator behavior not versioned

frontend recomputing Reward/performance

Arena edit after use

DRAFT Entity slipping into evaluation
```

---

# 57. Review classification

Claude returns:

```text
BLOCKER
HIGH
MEDIUM
LOW
SUGGESTION
```

and milestone status:

```text
READY TO CLOSE
READY WITH CORRECTIONS
NOT READY TO CLOSE
```

Any BLOCKER/HIGH Tier-3 correctness issue prevents milestone closure.

---

# 58. Versioning During Development

Target final release:

```text
1.5.0
```

Internal implementation work may remain on a development version until the complete milestone is ready.

Avoid shipping half of the research loop as separate public milestones unless real testing requires a user-visible intermediate ZIP.

If intermediate ZIPs are necessary:

```text
1.5.0-implementation snapshots
```

should not pretend to be the completed milestone.

Given the project's existing semantic version convention, the preferred workflow is:

```text
build entire accepted milestone
→ package 1.5.0
→ test
→ Claude review
→ corrections become 1.5.x if needed
```

---

# 59. Explicit Non-Goals

Do not add during 1.5.0:

```text
Evolution breeding
lifespan execution
MarketMemoryCell scoring
PromotionDecision implementation
Final Holdout
Bayesian proposer
multi-symbol allocation
shorting
margin
borrow fees
limit orders
partial fills
order book simulation
live brokerage execution
LLM-generated strategies
arbitrary user code strategies
rich chart replay if it threatens core-loop completion
```

---

# 60. Definition of Done

`1.5.0` is complete when the application can demonstrate:

```text
1. Quick Create a Candidate.

2. Configure Moving Average Cross traits.

3. Finalize DRAFT → READY.

4. Create/version an Arena.

5. Resolve an immutable MarketDataSnapshot with required warmup.

6. Run an EvaluationRun.

7. Observe completed-bar t only.

8. Make a deterministic strategy decision.

9. Fill at t+1 open.

10. Maintain deterministic account state.

11. Force-liquidate at final evaluated close.

12. Produce immutable ExperienceEvents.

13. Produce immutable ExperienceTrace.

14. Calculate buy-and-hold benchmark.

15. Calculate Reward.

16. Evaluate every hard gate.

17. Persist the complete scientific result atomically.

18. Stamp all reproducibility versions/hashes.

19. Inspect the result in the UI.

20. Re-run the same fixture and reproduce the same scientific output.

21. Prove lookahead is structurally blocked.

22. Pass full application regression suite.

23. Pass targeted Tier-3 Claude review.
```

---

# 61. Implementation Start

Architecture is closed.

Recommended next action:

```text
Begin Pass A
→ Strategy Contract
→ Candidate DRAFT/READY
→ StrategyRegistry
→ Trait schema
→ Indicator library
→ Moving Average Cross
```

Pass A should be completed and tested before Pass B code begins, even if all passes ultimately ship together as `1.5.0`.
