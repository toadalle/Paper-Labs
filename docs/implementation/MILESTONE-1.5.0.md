# Paper Lab — Milestone 1.5.0: Executable Research

## Scope

1.5.0 implements the first complete executable scientific loop:

```text
Candidate DRAFT
→ configure Moving Average Cross
→ READY immutable birth configuration
→ versioned Arena + immutable MarketDataSnapshot
→ EvaluationRun
→ deterministic next-bar-open execution
→ immutable Experience / Events / Trace
→ Reward + Hard Gates
→ structured Experience Inspector
```

## Entity strategy configuration

- Quick Create produces `CANDIDATE / DRAFT`.
- DRAFT strategy/traits may be explicitly saved.
- Finalization validates Moving Average Cross traits and computes a deterministic SHA-256 trait hash.
- READY strategy identity/traits are birth-immutable.
- DRAFT Candidates cannot evaluate.

## Strategy and indicators

- New `StrategyRegistry` / `StrategyDefinition` boundary.
- Baseline `MOVING_AVERAGE_CROSS` v1.
- V1 actions: `HOLD` or `TARGET_POSITION` in `[0, 1]`.
- Shared bounded-history SMA implementation.
- `INDICATOR_LIBRARY_VERSION = 1.0.0`.

## Arenas and policies

- Arena creation captures an immutable historical MarketDataSnapshot.
- Arena families now support real version creation through `rootArenaId` + monotonic family version.
- Separate immutable ExecutionPolicy and RewardPolicy objects.
- V1 UI configures capital, warmup, commission, slippage, Reward λ, max-drawdown gate, and minimum strategy fills.
- Used Arena versions lock through completed Experience persistence.

## Evaluation engine

- `EXECUTION_ENGINE_VERSION = 1.0.0`.
- Single-symbol / 1Day / long-only / fractional-share V1.
- Warmup captured before evaluated start and marked in Trace.
- Decision on completed bar `t`, fill at `t+1` open.
- Final position forced liquidated at final evaluated close.
- Strategy-originated fills count toward minimum activity; terminal cleanup does not.
- Buy fees enter cost basis; sell fees reduce realized PnL.
- Snapshot artifact hash is verified before execution.

## Scientific evidence

Successful EvaluationRun atomically persists:

- immutable Experience,
- immutable ExperienceEvents,
- immutable ExperienceTrace,
- EvaluationRun completion,
- required AuditEvent.

Cancellation/failure produces no Experience.

Experience stamps Arena version, snapshot hash, strategy type/version, an immutable strategy-trait snapshot plus trait hash, policy IDs/versions, engine version, and indicator-library version.

## Reward and gates

Backend computes and persists:

- starting/ending capital,
- total return,
- buy-and-hold benchmark return,
- excess return,
- max drawdown,
- strategy fill count,
- Reward decomposition,
- all HardGateResults.

The frontend only renders these values.

## Experience Inspector

A structured Inspector now exposes:

- Summary,
- Reward decomposition,
- Hard Gates and failure reasons,
- fill execution table,
- scrollable immutable Trace table,
- strategy/trait identity,
- snapshot/policy/engine/indicator provenance.

Rich chart replay remains deferred to 1.5.x.

## Validation

The automated suite covers:

- DRAFT/READY immutability,
- deterministic strategy/indicator behavior,
- bounded-history no-lookahead behavior,
- next-bar-open timing,
- warmup/evaluated Trace distinction,
- terminal liquidation,
- hard-gate semantics,
- Arena family versioning,
- atomic scientific persistence,
- completion-Audit rollback,
- cancelled-run no-Experience rule,
- frontend/backend scientific-calculation boundary,
- full prior frontend/observability regressions.

Tier-3 Claude review completed after packaging. It verified the scientific execution core and found one HIGH EvaluationRun cancellation-status race. That job-state arbitration defect is corrected and regression-tested in `MILESTONE-1.5.1.md`; no scientific execution formula/version change was required.
