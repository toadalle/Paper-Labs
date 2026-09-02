# Paper Labs V1 — Frozen Architecture Summary

## Identity

Paper Labs is an **Entity research system first, evolutionary simulation second**.

## Entity

`Entity` is the primary research object.

Lifecycle:
- `CANDIDATE`
- `PERMANENT`
- `RETIRED`

`candidateStatus` is `ACTIVE | DEAD | null` and is non-null only for Candidates.

`evolutionRunId` is meaningful only while Candidate. `birthEvolutionRunId` permanently records origin.

Lineage is automatic and immutable. Family is a manual/inherited label in V1.

## Arena and EvaluationSuite

Arena is immutable/versioned research context.

EvaluationSuite assigns Arena versions to:
- Discovery
- Validation
- Final Holdout

One Arena version may occupy only one role in one suite version.

## Experience

One Experience is one complete Entity evaluation against one Arena version.

ExperienceEvent is immutable atomic evidence within an Experience.

## Market Memory

MarketMemoryCell is a rebuildable deterministic projection over immutable Experience evidence, never source of truth.

V1 uses deterministic regime snapshots, bucketed regime keys, Experience-count decay, reliability-weighted Approval, and traceable evidence. No embeddings, LLM patterns, vector similarity, or learned prototypes.

## Reward and hard gates

`Reward = excess_return - lambda * max_drawdown`

Hard gates are non-compensable constraints and include drawdown, activity, execution/state validity, exposure, and data-integrity/lookahead failures.

Constants and policies are versioned and stamped.

## Lifespan and survival

Lifespan is a fixed maximum count of completed Experiences.

Cycle order includes hard gates and lifespan death before breeding.

Survival:
- hard-gate failure -> dead
- grace if age < min survival age
- otherwise median of last min(age,4) Discovery Rewards
- fail if score <= survival floor

Initial defaults:
- min survival age 4
- survival floor 0

## Breeding

V1 operators:
- Variant 75%
- Mutation 25%

No crossover.

Initial defaults:
- min breeding age 4
- top 25% of mature surviving candidates
- max 1 child/parent/cycle
- max 2 lifetime offspring

## Population

Default active cap: 64  
Minimum viable: 8

No score eviction, random refill, or birth queue.

Collapse below minimum with no eligible births produces `POPULATION_COLLAPSE`.

## Promotion

Human decision only.

Routine promotion uses Validation, never Final Holdout.

Default eligibility:
- >= 8 Validation Arenas
- zero validation hard-gate failures
- median Validation Reward > 0
- consistency >= 60%
- worst validation drawdown <= hard limit

Comparison vector:
- Median Validation Reward
- Worst Validation Drawdown
- Consistency
- Coverage

No scalar promotion score.

PromotionDecision is immutable.

## EvolutionRun / EvolutionPolicy

EvolutionRun statuses:
- DRAFT
- RUNNING
- COMPLETED
- POPULATION_COLLAPSE
- CANCELLED
- FAILED

EvolutionPolicy is versioned and immutable once used.

## CandidateProposer

Protocol:
- initialize(search_space, seed, policy)
- ask(count, context)
- tell(results)
- snapshot_state()

Proposer implementations may include Evolution, Random, Quasi-grid, Bayesian. All use the same Entity/Arena/Experience/Memory pipeline.

## Search Benchmark

Discovery / Validation / Final Holdout with frozen statistical policy.

Only proposer/search strategy changes if Evolution loses; the Entity architecture remains.

## Deferred

- crossover/two-parent Child
- partner selection
- automatic Family clustering
- lifespan extension/reproduction cost
- structural mutation
- quantitative novelty
- historical similarity/vector search
- Portfolio
- LLM allocator/manager
- LLM write-back to memory
