# Paper Labs — Legacy Codebase Gap Analysis

**Status:** implementation input for 1.0.0

## Summary

The supplied pre-V1 project is technically functional and its 120 tests pass, but its product/domain model is centered on legacy concepts: Agent, Training, Replay, Challenge, Experiment, Template, and associated lifecycle/UI flows.

The V1 target instead centers on Entity, Arena, Experience, MarketDataSnapshot, EvolutionRun, immutable evidence, deterministic memory projection, and human promotion decisions.

The implementation strategy is therefore clean-sheet by default.

## KEEP — concept only

- deterministic canonical hashing
- Alpaca capability-state distinction
- provider request pacing
- immutable market-data artifact idea
- runtime-neutral browser/domain boundaries
- SQLite as an isolated persistence implementation

These concepts were reimplemented in 1.0.0 rather than copied as legacy modules.

## REPLACE

- Agent -> Entity
- Training -> EvolutionRun + CandidateProposer + Arena/Experience evaluation
- Replay -> Arena/Experience execution/review
- Challenge -> Arena + EvaluationSuite
- Experiment -> bounded research workflows over the same Arena/Experience engine
- legacy template/module catalogs -> future Entity trait/search-space model
- legacy frontend feature navigation -> Entities / Arenas / Evolution / Benchmark research shell
- old storage object vocabulary -> V1 domain object kinds

## REMOVE

- divergent training simulator concepts
- legacy Training preflight/job semantics tied to the old model
- Challenge phases as their own product noun
- old Agent-library product structure
- legacy Replay editing surface
- generated `dist/` and old persisted SQLite state from source distribution
- historical dataset artifacts from the old project archive

## 1.0.0 target

The first milestone establishes the V1 vocabulary, invariants, persistence boundary, market-data provenance boundary, and frontend shell. It intentionally stops before Arena execution and Evolution scheduling.
