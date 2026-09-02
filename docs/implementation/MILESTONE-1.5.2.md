# Paper Lab — Iteration 1.5.2: Research Workflow Usability

## Scope

1.5.2 corrects the first hands-on usability problems found while testing the new 1.5 executable-research workflow. Scientific execution semantics are unchanged.

## Entity draft validation state

A failed DRAFT strategy save/finalization now preserves the exact attempted strategy values in frontend state across normal application/notification rerenders.

Previously a rejected request could be followed by a full application render that restored the last persisted values or default `10 / 30 / 1` values. That made a correct server validation message appear to contradict the fields visible after the failure.

The server remains authoritative for trait validation. The frontend simply preserves the attempted input so the error and the form refer to the same configuration.

A direct regression confirms the baseline Moving Average Cross configuration:

```text
fast_window = 10
slow_window = 30
target_exposure = 1
```

is accepted by the strategy definition.

## Arena authoring

Arena creation now makes the supported V1 timeframe explicit:

```text
Timeframe
→ 1 Day
```

Executable Research V1 remains `1Day` only; this is an authoring-surface correction, not new timeframe support.

Required fields are no longer silently populated with a sample research scenario:

```text
Name
Symbol
Start
End
```

Optional policy fields may remain blank. Their inputs show the server-owned defaults as placeholders instead of submitting a large set of implicit-looking form values.

Current server defaults remain:

```text
Initial capital          10000
Warmup bars              200
Commission / fill        0
Slippage                  1 bps
Reward λ                  1
Max drawdown gate         0.35
Minimum strategy fills   1
```

## Initial-capital browser validation

The previous HTML control combined:

```text
min=1
step=100
value=10000
```

which makes valid values `1 + 100n`; therefore Chrome correctly but confusingly suggested `9901` and `10001` around `10000`.

The control now uses:

```text
min=0.01
step=0.01
```

so ordinary capital values such as `10000` are browser-valid.

## Run Evaluation discoverability

A selected Arena now owns an Actions section in the Arena Inspector.

If READY active Candidate Entities exist:

```text
Ready Entity [select]
Run Evaluation
```

is available directly from the Arena.

Entity Inspector evaluation remains available. Both entry points call the same shared frontend `runEvaluation(entityId, arenaId)` path and the same backend `/api/evaluations` application service.

## Versioning

```text
PRODUCT_VERSION           1.5.2
EXECUTION_ENGINE_VERSION  1.0.0
INDICATOR_LIBRARY_VERSION 1.0.0
```

No scientific version changed because strategy decisions, fill ordering, accounting, ExperienceTrace, Reward, hard gates, and reproducibility stamps are unchanged.
