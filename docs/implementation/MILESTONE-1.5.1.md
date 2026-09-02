# Paper Lab — Iteration 1.5.1: Evaluation Cancellation Integrity

## Scope

1.5.1 is the Tier-3 correction following Claude's direct implementation review of 1.5.0.

## Corrected cancellation race

`EvaluationService.run()` contains asynchronous boundaries before scientific execution, including immutable MarketDataSnapshot loading. A user may cancel the persisted `EvaluationRun` while `run()` is awaiting that work.

The failure path now reloads the current persisted EvaluationRun before deciding whether to write `FAILED`:

```text
current persisted status == RUNNING
→ legitimate execution/load failure
→ RUNNING → FAILED
→ EVALUATION_FAILED AuditEvent

current persisted status != RUNNING
→ another terminal transition already owns the outcome
→ preserve it
→ no replacement FAILED write/audit
```

This specifically preserves:

```text
RUNNING
→ user cancel
→ CANCELLED
→ awaited load returns
→ active-run guard throws
→ CANCELLED remains authoritative
```

No Experience, ExperienceEvent, or ExperienceTrace is created for the cancelled run.

## Regression coverage

A controlled deferred snapshot loader now exercises the real interleaving:

1. EvaluationRun is persisted as RUNNING.
2. `run()` blocks while awaiting snapshot load.
3. `cancel()` transitions the same run to CANCELLED and appends `EVALUATION_CANCELLED`.
4. snapshot loading is released.
5. `run()` detects the run is no longer active.
6. persisted status remains CANCELLED.
7. `EVALUATION_FAILED` is absent.
8. scientific result tables remain empty.

## Activity semantics confirmed

No behavior change was made to minimum activity. D-036 already defines forced terminal liquidation as engine cleanup rather than strategy activity. `tradeCount` therefore continues to count decision-driven strategy fills only.

## Execution-loop cleanup

The bounded-history index now derives directly from the known evaluated-array offset:

```text
currentGlobalIndex = firstEvaluatedIndex + evaluatedIndex
```

instead of searching the full sorted bar array with `findIndex()` every evaluated step. This removes the identified O(n²) lookup pattern without changing the bounded-history or no-lookahead contract.

## Versioning

```text
PRODUCT_VERSION           1.5.1
DOMAIN_SCHEMA_VERSION     unchanged
EXECUTION_ENGINE_VERSION  1.0.0
INDICATOR_LIBRARY_VERSION 1.0.0
```

The scientific engine version does not change because the correction affects EvaluationRun job-state arbitration around asynchronous cancellation, not Strategy decisions, fills, accounting, Trace semantics, Reward, or Experience scientific outputs.
