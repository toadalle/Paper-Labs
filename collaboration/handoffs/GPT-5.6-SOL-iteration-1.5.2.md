# GPT-5.6 Sol — Paper Lab 1.5.2 Research Workflow Handoff

## Baseline

```text
source: paper_labs_1.5.1.zip
target: paper_labs_1.5.2.zip
```

## User-reported issues

First hands-on 1.5 testing exposed four workflow problems:

1. failed Entity DRAFT validation could rerender the form back to persisted/default values, making the visible fields contradict the error;
2. Initial Capital used an invalid step/base combination for `10000`, causing Chrome to suggest `9901 / 10001`;
3. Arena timeframe existed internally but was not an explicit create control;
4. evaluation was discoverable only from the Entity Inspector, not from the selected Arena itself.

## Corrections

- preserve attempted DRAFT strategy values across rejected saves/finalization and notification rerenders;
- add direct regression that Moving Average Cross `10 / 30 / 1` validates;
- expose `Timeframe = 1 Day` explicitly in Arena creation;
- remove sample Name/Symbol/date prefills;
- represent optional execution/reward values as blank fields with visible server-default placeholders;
- change Initial Capital to `min=0.01`, `step=0.01`;
- add Arena Inspector `Ready Entity` selector + `Run Evaluation` action;
- share one frontend evaluation request path between Entity and Arena entry points.

## Scientific impact

None.

```text
EXECUTION_ENGINE_VERSION  1.0.0
INDICATOR_LIBRARY_VERSION 1.0.0
```

No Tier-3 scientific formula or temporal contract changed.
