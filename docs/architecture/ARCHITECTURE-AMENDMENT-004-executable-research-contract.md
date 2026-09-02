# Architecture Amendment 004 — Executable Research Contract

**Status:** accepted for Paper Lab 1.5.0  
**Applies to:** Entity strategy identity, Arena evaluation, EvaluationRun, Experience, ExperienceEvent, ExperienceTrace, execution/reward policies, reproducibility.

## Purpose

Paper Lab 1.5.0 closes the gap between research objects and executable scientific evidence. The canonical loop is:

```text
READY Entity
  → immutable Arena version
  → EvaluationRun
  → deterministic Execution Engine
  → immutable Experience + ExperienceEvents + ExperienceTrace
  → Reward + HardGateResults
```

An Experience is only scientific evidence when the evaluation completed validly. User cancellation or invalid execution produces no Experience.

## Entity readiness and strategy identity

Candidate Entities have `configurationStatus = DRAFT | READY`.

- DRAFT owns identity but is not eligible for evaluation, breeding, survival ranking, or promotion.
- DRAFT strategy configuration may be saved and edited.
- DRAFT → READY validates and freezes `strategyType`, `strategyVersion`, normalized traits, and `traitHash`.
- READY birth configuration may never be rewritten in place.

Executable strategy behavior is registered code, not arbitrary Entity code. An executable Entity is identified by:

```text
strategyType + strategyVersion + immutable validated traits
```

V1 registers `MOVING_AVERAGE_CROSS` v1 with `fast_window`, `slow_window`, and `target_exposure` traits.

## Strategy and indicator boundary

Strategy code receives symbol-keyed observations plus bounded history through the current completed bar. It never receives provider, repository, database, or full-snapshot handles.

The shared deterministic indicator library is separately versioned. Indicator functions receive only bounded permitted history. Every Experience stamps `indicatorLibraryVersion` so indicator corrections cannot silently reinterpret old results.

## Arena and policies

An Arena is a versioned immutable evaluation environment once used. An Arena version owns the evaluated symbol/window/capital/warmup contract and references immutable versioned:

- `ExecutionPolicy`
- `RewardPolicy`
- `MarketDataSnapshot`

New configurations create new Arena versions in the same `rootArenaId` family; used Arena versions are never overwritten.

V1 is deliberately single-symbol, long-only, 1Day, and fractional-share capable. Contracts remain symbol-keyed for future multi-symbol expansion.

## Warmup and evaluated window

`Arena.timeWindow.start` is the first fully-informed evaluated decision bar. Market-data capture extends backward as required by Arena warmup and strategy lookback.

Warmup points:

```text
isWarmup = true
isEvaluated = false
```

Warmup may initialize deterministic indicators/state but does not contribute evaluated trading performance or benchmark return.

Missing required warmup/evaluated coverage fails the EvaluationRun. Paper Lab never silently shortens the Arena window.

## Execution ordering

V1 ordering is frozen:

```text
observe completed bar t
  → compute bounded indicators
  → Strategy decides TARGET_POSITION/HOLD
  → target waits
  → fill at bar t+1 OPEN
```

Same-bar fills are unsupported in V1.

At the final evaluated bar, any open position is forcibly liquidated at that bar's CLOSE. ExecutionPolicy costs apply to terminal liquidation.

`tradeCount` / minimum-activity semantics count strategy-originated fills. Forced terminal liquidation is system cleanup and does not satisfy strategy activity.

## Account and execution costs

The engine centrally owns cash, fractional quantity, cost basis, realized/unrealized PnL, equity, exposure, peak equity, and max drawdown. Strategy code expresses target exposure only and never performs account bookkeeping.

Commission and slippage are deterministic ExecutionPolicy inputs and are applied exactly once per fill. Buy fees are incorporated into cost basis; sell fees reduce realized PnL.

## EvaluationRun vs Experience

`EvaluationRun` is mutable execution-job state:

```text
DRAFT | RUNNING | COMPLETED | CANCELLED | FAILED
```

`Experience` is immutable scientific evidence.

- `CANCELLED` → no Experience.
- `FAILED` → no valid Experience/performance signal.
- successful execution → `COMPLETED` EvaluationRun + immutable Experience.
- hard-gate failure or negative Reward may still belong to a valid completed Experience.

V1 execution is isolated in memory and scientific results are committed atomically at completion.

## ExperienceEvent vs ExperienceTrace

`ExperienceEvent` records discrete causal/action evidence. V1 persisted events are:

```text
EXPERIENCE_STARTED
DECISION_EMITTED
ORDER_REJECTED (when a valid action cannot execute under policy)
FILL_EXECUTED
FORCED_LIQUIDATION
HARD_GATE_TRIGGERED
EXPERIENCE_COMPLETED
```

The closed design discussion also named `EXPERIENCE_FAILED`; implementation clarifies that a failed EvaluationRun creates no Experience and therefore cannot own an ExperienceEvent stream. Evaluation failure is represented by EvaluationRun failure fields plus the authoritative `EVALUATION_FAILED` AuditEvent. `EXPERIENCE_FAILED` remains reserved unless a future result model gives failed scientific attempts a valid immutable evidence owner. This clarification is explicitly included in the post-build Tier-3 review scope.

`ExperienceTrace` is a first-class immutable dense time-series artifact. It distinguishes warmup/evaluated regions and records research-relevant account/market/benchmark/decision state without turning every bar into an event.

## Reward and hard gates

V1 benchmark is buy-and-hold from the first evaluated bar open through the final evaluated bar close on the same instrument/window/capital basis.

```text
excess_return = Entity total return - benchmark return
Reward = excess_return - λ × max_drawdown
```

The backend persists Reward components; the frontend displays them and never recomputes scientific formulas.

Initial hard gates cover:

- max drawdown,
- minimum strategy activity,
- maximum exposure,
- execution validity,
- data integrity / no-lookahead validity.

Hard-gate failure is non-compensable for eligibility, but does not turn a correctly executed Experience into an execution failure.

## Reproducibility stamps

Every completed Experience records:

```text
entity_id
strategy_type
strategy_version
trait_hash
arena_id/version
immutable strategy trait snapshot + trait_hash
market_data_snapshot_id/content_hash
execution_policy_id/version
reward_policy_id/version
execution_engine_version
indicator_library_version
random_seed when randomness exists
```

The immutable Experience also stores the normalized strategy trait snapshot itself, not only its hash, so later Entity retirement/deletion cannot remove the inputs required to explain or replay historical research. V1 strategy execution is deterministic and uses no runtime random seed.

## Atomic scientific commit

On success the following commit as one transaction:

```text
Experience
ExperienceEvents
ExperienceTrace
EvaluationRun → COMPLETED
required completion AuditEvent
```

Required Audit failure rolls the scientific commit back. The Arena version becomes locked by the completed Experience within the same transaction boundary.

## Frontend contract

1.5.0 must expose enough structured evidence to explain an Experience without a chart replay:

- summary/performance,
- Reward decomposition,
- hard gates,
- fills,
- immutable Trace table,
- strategy/trait identity,
- MarketDataSnapshot provenance,
- policy versions,
- execution-engine and indicator-library versions.

Rich chart replay is a separate 1.5.x enhancement and must reuse immutable snapshot/trace evidence rather than Live data.
