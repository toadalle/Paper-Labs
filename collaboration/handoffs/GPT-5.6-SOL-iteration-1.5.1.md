# GPT-5.6 Sol — Paper Lab 1.5.1 Tier-3 Correction Handoff

## Baseline / target

```text
baseline: paper_labs_1.5.0.zip
target:   paper_labs_1.5.1.zip
```

## Claude finding addressed

The 1.5.0 Tier-3 review found one HIGH issue: cancellation during an awaited operation could persist `CANCELLED`, then be overwritten by `run()`'s catch path as `FAILED` when the active-run guard threw.

## Correction

`EvaluationService.run()` now reloads the current persisted EvaluationRun in its catch path and writes `FAILED` only when that run is still `RUNNING`.

If another terminal transition already owns the run outcome:

```text
CANCELLED
COMPLETED
or any non-RUNNING terminal state
```

`run()` preserves it and rethrows without a replacement FAILED write or `EVALUATION_FAILED` AuditEvent.

## Regression test

Added a controlled asynchronous cancellation test that blocks snapshot loading, cancels the live RUNNING job, releases loading, and verifies:

```text
persisted status        CANCELLED
Experience              none
ExperienceEvents         none
ExperienceTrace          none
EVALUATION_CANCELLED     present
EVALUATION_FAILED        absent
```

## Low review notes

- Forced liquidation remains excluded from `tradeCount` by explicit existing D-036 policy.
- Removed the evaluated-loop O(n²) `findIndex()` lookup; bounded history now uses `firstEvaluatedIndex + index`.

## Scientific-version impact

None. `EXECUTION_ENGINE_VERSION` and `INDICATOR_LIBRARY_VERSION` remain `1.0.0` because this correction changes EvaluationRun terminal-state arbitration, not scientific execution outputs.
