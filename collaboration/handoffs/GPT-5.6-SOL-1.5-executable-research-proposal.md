# Paper Lab — 1.5.0 Executable Research Proposal

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T12:10:00-05:00  
**Thread:** architecture / research engine / implementation  
**Status:** proposal — Claude peer design review requested  
**Current project baseline:** `paper_labs_1.4.0.zip`  
**Target milestone:** `1.5.0 — Executable Research`  
**Implementation:** NOT started

---

# 1. Purpose

Paper Lab now has a strong application shell and a substantially settled research architecture:

```text
Entity
Arena
Experience
ExperienceEvent
MarketDataSnapshot
Market Memory
Evolution
Promotion
Benchmarking
Audit
Research Validity
```

But the application is still missing the most important executable contract:

> **What exactly does an Entity do when it is evaluated inside an Arena?**

Until this is defined concretely:

```text
Arena cannot truly evaluate an Entity
Experience cannot represent a meaningful run
Reward has no real execution substrate
Memory has no real decisions to learn from
Evolution has nothing concrete to mutate
Promotion has nothing operational to validate
Benchmarking has nothing fair to compare
```

The goal of this design round is to define the first complete research loop:

```text
Entity
   ↓
Arena
   ↓
Execution Engine
   ↓
Experience
   ↓
Reward + Hard Gates
```

Once this loop exists, Paper Lab becomes an executable research system rather than only a structured framework.

---

# 2. Target Milestone Definition

Proposed:

```text
1.5.0 — Executable Research
```

The milestone should allow the user to:

```text
create/configure a root Entity
        ↓
create/configure an Arena
        ↓
run the Entity through the Arena
        ↓
produce an immutable Experience
        ↓
inspect decisions/trades/state/equity
        ↓
understand Reward and hard-gate outcomes
```

The success test should be:

> **Given one Entity and one Arena, Paper Lab can deterministically execute the evaluation, persist every research-relevant event, calculate Reward, apply hard gates, and explain the result in the UI.**

---

# 3. Scope

This design round should settle:

```text
Entity Strategy Contract
Root Entity creation
Observation model
Action model
Execution model
Portfolio/account state inside one Experience
Market data consumption
Arena runtime specification
Transaction costs/slippage
ExperienceEvent taxonomy
Reward input computation
Hard-gate evaluation
Execution validity
Determinism/reproducibility
Replay/inspection requirements
```

This design round should NOT yet settle:

```text
Market Memory scoring internals
Evolution survival/breeding implementation
Promotion workflow implementation
Search Benchmark implementation
live brokerage deployment
Portfolio product feature
LLM trading agents
WebSocket streaming
```

Those depend on the executable research substrate being real first.

---

# 4. Existing Frozen Constraints

This proposal must remain consistent with the already frozen architecture.

## Entity

Entity is the primary research object.

Lifecycle:

```text
CANDIDATE
PERMANENT
RETIRED
```

Candidate status:

```text
ACTIVE
DEAD
null otherwise
```

Traits are birth-immutable.

Lineage is automatic/immutable.

Family is manual/inherited metadata.

---

## Arena

Arena is immutable/versioned once used.

Arena itself does not intrinsically own:

```text
Discovery
Validation
Final Holdout
```

Those roles belong to EvaluationSuite.

---

## Experience

One Experience is:

> one complete Entity evaluation against one Arena version.

Experience is the lifespan-counting unit.

---

## ExperienceEvent

Immutable atomic event inside an Experience.

---

## Reward

Frozen V1 shape:

```text
Reward = excess_return - λ * max_drawdown
```

with versioned λ.

Hard gates are non-compensable.

Examples already established:

```text
drawdown limit
minimum activity/trade count
execution/state validity
exposure limits
no lookahead/data-integrity failure
```

---

## Research Validity

Scored research data must use the immutable provenance path:

```text
MarketDataProvider
        ↓
normalized dataset
        ↓
MarketDataSnapshot
        ↓
Experience
```

Live browsing remains ephemeral and separate.

---

# 5. Proposed Entity Strategy Contract

GPT proposes that an Entity should not be executable merely because it has an arbitrary trait map.

Instead, each Entity should reference a **strategy specification** with a stable contract.

Conceptually:

```ts
Entity {
  id
  name
  lifecycleState
  traits
  strategyType
  strategyVersion
  ...
}
```

The strategy contract interprets traits.

Example:

```ts
interface StrategyDefinition<TTraits> {
  strategyType: string;
  strategyVersion: number;

  validateTraits(traits: TTraits): ValidationResult;

  initialize(context: StrategyInitContext): StrategyState;

  decide(input: StrategyStepInput<TTraits>): StrategyDecision;

  finalize?(context: StrategyFinalizeContext): void;
}
```

The Entity owns immutable trait values.

The executable strategy implementation owns:

```text
how those traits are interpreted
what observations matter
what actions may be emitted
```

This avoids turning Entity traits into ad hoc executable code.

---

# 6. Why Strategy Type + Version Should Be Explicit

Evolution must eventually mutate Entities safely.

Therefore a Candidate should be understandable as:

```text
strategyType
+
strategyVersion
+
trait values
```

Example conceptual strategy types:

```text
moving_average_cross
momentum
mean_reversion
breakout
```

This does NOT mean Paper Lab needs many strategies in 1.5.

GPT recommends implementing **one deliberately simple baseline strategy family first** to validate the architecture.

Potential baseline:

```text
moving-average trend / crossover
```

or similarly deterministic rule-based behavior.

Claude should challenge which baseline is most useful.

---

# 7. Strategy Registry

Proposed:

```text
StrategyRegistry
```

maps:

```text
strategyType + version
→ StrategyDefinition
```

Benefits:

```text
deterministic execution
versioned historical interpretation
trait validation
evolution search-space definition
UI schema generation later
```

An old Experience remains reproducible because Paper Lab knows which strategy implementation version interpreted the Entity traits.

---

# 8. Root Entity Creation

The current Quick Create creates a generic Candidate.

For executable research, a root Entity must eventually receive birth traits.

The architecture already says traits cannot be casually rewritten after birth.

Therefore generic:

```text
New Entity N
```

cannot remain permanently traitless if it is expected to run.

GPT proposes separating:

```text
Entity draft/configuration
```

from:

```text
Entity birth/finalization
```

but without introducing another permanent domain lifecycle unless necessary.

Potential model:

```text
Quick Create
→ Candidate shell not yet executable
→ user configures strategy + traits
→ Finalize / Commit Birth Traits
→ Entity becomes executable
→ birth traits lock permanently
```

Open question:

Should an Entity exist in Candidate lifecycle before traits are finalized, or should configuration occur in a separate draft object and create the Entity only when finalized?

GPT currently prefers a separate lightweight **EntityDraft** if Claude believes Candidate must always mean a fully valid research object.

---

# 9. Alternative — Candidate With Configuration State

Simpler alternative:

```text
Entity.lifecycle_state = CANDIDATE
Entity.configuration_status =
  DRAFT
  READY
```

Once READY:

```text
strategy type/version/traits lock
```

This avoids another object type but adds another state dimension.

Claude should weigh:

```text
EntityDraft object
vs
Candidate.configuration_status
```

The goal is to preserve the invariant:

> An Entity that has participated in research must have immutable, valid birth traits.

---

# 10. Observation Model

The Strategy should receive a controlled observation object, not arbitrary repository/database access.

Conceptually:

```ts
StrategyStepInput {
  timestamp
  observation
  portfolioState
  previousDecision?
  traits
}
```

Observation may contain:

```text
current OHLCV bar
historical lookback permitted by Arena
derived indicators explicitly computed from past/current permitted data
market/session metadata
```

Critical rule:

> Strategy code cannot access future bars or unrestricted data sources.

---

# 11. Lookahead Prevention

The execution engine must expose data incrementally.

Conceptually:

```text
bar 1
→ decision

bar 2
→ decision

bar 3
→ decision
```

At timestamp `t`:

```text
available:
≤ t information

forbidden:
> t information
```

The Strategy should not receive:

```text
complete future dataset
raw repository
provider client
database handle
```

This makes lookahead structurally difficult rather than merely prohibited by convention.

---

# 12. Indicator Calculation

Open design question:

Where should indicators such as:

```text
moving averages
volatility
RSI
ATR
```

be calculated?

Possible model A:

```text
strategy implementation calculates them
from permitted historical observations
```

Possible model B:

```text
execution engine provides a deterministic indicator service
```

GPT leans toward:

```text
shared deterministic indicator library
+
Strategy chooses which indicators to use
```

Reason:

```text
avoid duplicated formulas
version calculation rules
make testing easier
```

but Strategy should still only receive data available up to current simulation time.

---

# 13. Proposed Action Model

V1 should keep the Strategy action surface deliberately small.

Potential:

```ts
type StrategyDecision =
  | { type: 'HOLD' }
  | { type: 'TARGET_POSITION'; targetFraction: number };
```

where:

```text
targetFraction = -1.0 ... +1.0
```

or perhaps:

```text
0.0 ... 1.0
```

if long-only V1.

This is significantly cleaner than forcing Strategies to construct low-level orders.

The Execution Engine converts desired exposure into deterministic simulated orders/fills.

Claude should review whether V1 should be:

```text
long-only
```

or:

```text
long/short
```

GPT currently prefers **long-only first** to reduce execution and risk complexity unless the research goals strongly require shorting immediately.

---

# 14. Why Target Position Instead of BUY/SELL

If Strategy emits:

```text
BUY 20 shares
SELL 10 shares
```

then each strategy becomes responsible for:

```text
capital awareness
position sizing
existing exposure
partial exits
cash constraints
```

That makes Evolution search harder and mixes signal generation with execution/accounting.

Target exposure:

```text
TARGET_POSITION 0.75
```

lets Strategy express intent while Execution Engine owns the mechanics.

Example:

```text
0.0
→ fully cash

0.5
→ 50% target exposure

1.0
→ fully invested
```

---

# 15. Position Sizing Boundary

Proposed:

```text
Strategy
→ desired target exposure

Execution Engine
→ actual quantity/fill based on:
   capital
   current position
   price
   exposure limits
   lot/fractional rules
   transaction costs
```

This keeps portfolio accounting centralized and testable.

---

# 16. Multi-Symbol Question

Earlier product discussions explored agents operating across multiple markets.

The frozen architecture does not require Entity to be intrinsically single-symbol.

However, implementing multi-symbol allocation immediately would increase complexity materially.

GPT proposes:

```text
1.5 V1 Experience
→ one Entity
→ one Arena
→ Arena may initially expose one tradable symbol
```

while designing the contract so observation/action structures can later expand to:

```text
multiple instruments
```

without rewriting Entity identity.

Claude should challenge whether this is too restrictive.

---

# 17. Arena Runtime Specification

Arena needs enough information to make an evaluation deterministic.

Proposed Arena version fields conceptually:

```text
name

instrument universe
market-data source/dataset reference policy

start
end
timeframe

initial capital
base currency

session rules

execution assumptions
transaction cost policy
slippage policy

exposure constraints
minimum trade/activity requirements

benchmark definition

reward policy version
hard-gate policy version

warmup/lookback policy
```

Some fields may live in referenced versioned policies rather than directly on Arena.

Claude should help separate:

```text
Arena identity
vs
ExecutionPolicy
vs
RewardPolicy
```

to avoid oversized Arena records.

---

# 18. Recommended Policy Separation

GPT proposes three versioned objects:

```text
Arena
ExecutionPolicy
RewardPolicy
```

Arena references:

```text
market/data/time window
instrument universe
initial capital
ExecutionPolicy version
RewardPolicy version
```

ExecutionPolicy owns:

```text
fill model
fees
slippage
position limits
fractional/lot rules
market-session behavior
```

RewardPolicy owns:

```text
λ
benchmark/excess-return method
hard-gate thresholds
```

This may be preferable to embedding every constant into Arena.

---

# 19. Market Data Capture

Arena execution must never query arbitrary current Live data.

Before or during execution:

```text
provider/dataset
→ normalized historical data
→ immutable MarketDataSnapshot
```

Experience stamps the snapshot ID/hash.

Execution consumes the snapshot.

Repeated execution against the same:

```text
Entity version
Arena version
MarketDataSnapshot
ExecutionPolicy
RewardPolicy
engine version
```

should produce the same Experience result.

---

# 20. Replayability

Every completed Experience should record enough identity to replay deterministically.

Proposed stamps:

```text
entity_id
strategy_type
strategy_version
trait_hash

arena_id/version

market_data_snapshot_id
content_hash

execution_policy_id/version
reward_policy_id/version

execution_engine_version

random_seed if randomness is ever used
```

For deterministic V1 strategies:

```text
no runtime randomness preferred
```

---

# 21. Execution Loop

Conceptually:

```text
load immutable Entity

load immutable Arena version

resolve MarketDataSnapshot

initialize portfolio/account state

initialize Strategy state

for each permitted market step:
    build observation
    Strategy.decide()
    validate decision
    convert target → simulated order
    apply execution model
    update account/position
    append ExperienceEvents
    update metrics

finalize

calculate Reward
apply hard gates

persist completed Experience
```

Need to define exact persistence/transaction boundaries.

---

# 22. Proposed Portfolio State Inside Experience

This is **simulation state**, not the future Portfolio product feature.

Minimum:

```ts
SimulationAccount {
  cash
  positionQuantity
  averageEntryPrice?
  marketValue
  equity
  realizedPnl
  unrealizedPnl
  peakEquity
  maxDrawdown
}
```

This state exists solely inside one Experience evaluation.

Do not confuse it with a persistent user Portfolio workspace.

---

# 23. Fill Model

V1 should be deliberately simple and deterministic.

Potential baseline:

```text
decision computed from bar t
        ↓
fill executes at bar t+1 open
```

This helps prevent accidental same-bar lookahead.

Alternative:

```text
decision at close
→ next bar open
```

GPT strongly prefers this model for V1.

It creates a clean temporal rule:

```text
observe completed bar
→ decide
→ fill next bar
```

Claude should challenge whether any Arena type requires same-bar execution.

---

# 24. End-of-Experience Position

Need an explicit rule.

GPT recommends:

```text
at Arena end
→ forced liquidation using deterministic terminal rule
```

so:

```text
final equity
return
reward
```

are consistently realized/comparable.

Potential terminal fill:

```text
final bar close
```

or:

```text
last executable price
```

must be specified by ExecutionPolicy.

---

# 25. Transaction Costs

V1 should support versioned costs even if defaults are zero/minimal.

Potential:

```text
fixed commission per trade
+
basis-point fee/slippage
```

GPT recommends avoiding complex market-impact simulation initially.

Example:

```text
commission = $0
slippage = 1 bp
```

but exact defaults should be calibrated rather than assumed here.

The architecture must support nonzero cost because cost-free strategies can produce misleading research results.

---

# 26. Fractional Shares

Question:

Should simulated execution allow fractional shares?

GPT leans:

```text
YES for V1
```

because target-fraction exposure becomes much cleaner and modern broker simulation commonly permits fractional-style allocation.

But this should be a versioned ExecutionPolicy choice.

---

# 27. ExperienceEvent Taxonomy

The event stream should explain exactly what happened without duplicating every state snapshot unnecessarily.

Proposed initial event types:

```text
EXPERIENCE_STARTED

DECISION_EMITTED

ORDER_CREATED
ORDER_REJECTED

FILL_EXECUTED

POSITION_CHANGED

HARD_GATE_TRIGGERED

EXPERIENCE_COMPLETED
EXPERIENCE_FAILED
```

Possibly:

```text
FORCED_LIQUIDATION
```

Claude should challenge whether:

```text
DECISION_EMITTED
ORDER_CREATED
POSITION_CHANGED
```

are all necessary or whether this is too verbose.

---

# 28. Event vs Time-Series Data

Do not put an ExperienceEvent around every derived metric if a structured time-series artifact is more appropriate.

Potential split:

```text
ExperienceEvent
→ important atomic actions/transitions

ExperienceTrace
→ deterministic time-series:
   equity
   cash
   exposure
   drawdown
   benchmark
```

This could make chart replay much easier.

Open question:

Should `ExperienceTrace` become a first-class immutable artifact in 1.5?

GPT currently favors **yes** if it prevents thousands of generic "state updated" ExperienceEvents.

---

# 29. Experience Result Shape

Completed Experience should expose:

```text
status

starting capital
ending equity

total return
benchmark return
excess return

max drawdown

trade count
activity metrics

reward
hard-gate results

researchValidity

snapshot references
strategy/policy versions
```

All business calculations occur backend/domain-side.

Frontend only displays them.

---

# 30. Hard Gates

Already frozen conceptually.

1.5 must make them executable.

Initial gates:

```text
max drawdown <= configured limit

trade/activity count >= configured minimum

no invalid execution state

exposure never exceeds limit

no lookahead/data-integrity failure
```

Need explicit outcome shape:

```ts
HardGateResult {
  gate
  passed
  observedValue?
  limit?
  reason?
}
```

Experience stores all gate outcomes.

---

# 31. Reward Calculation

Frozen:

```text
Reward = excess_return - λ * max_drawdown
```

Need to define:

```text
excess_return = Entity return - benchmark return
```

Benchmark must therefore be deterministic within Arena.

Potential benchmark:

```text
buy-and-hold instrument
```

for a single-symbol Arena.

Claude should confirm this is the right default V1 benchmark.

---

# 32. Invalid Experience vs Bad Experience

Important distinction:

```text
valid but poor performance
→ completed Experience
→ negative Reward

invalid research execution
→ failed/invalid Experience
→ cannot be treated as normal low Reward
```

Examples invalid:

```text
corrupted snapshot
lookahead violation
non-finite portfolio state
impossible negative cash when prohibited
execution invariant break
```

Need explicit Experience status semantics.

---

# 33. Proposed Experience Status

Potential:

```text
RUNNING
COMPLETED
FAILED
```

with separate:

```text
researchValidity
```

already established.

Question:

Should hard-gate failure still produce:

```text
COMPLETED
```

with:

```text
hardGatePassed = false
```

or use another status?

GPT recommends:

```text
COMPLETED
```

for successfully executed but gate-failing research.

`FAILED` should mean the evaluation itself could not validly complete.

---

# 34. Deterministic Engine Version

Introduce:

```text
EXECUTION_ENGINE_VERSION
```

stamped onto Experience.

Any future behavior change affecting fills/state/reward sequencing increments this version.

This gives us a clean audit/debug story.

---

# 35. Concurrency

Do not optimize for huge parallel execution yet.

But design service boundaries so:

```text
run Experience A
run Experience B
```

do not share mutable simulation state.

Each Experience gets isolated:

```text
Strategy state
SimulationAccount
trace
event buffer
```

Persistence should be coordinated safely.

---

# 36. Persistence Strategy

Potential execution approach:

```text
create RUNNING Experience
        ↓
execute in isolated memory
        ↓
persist immutable result/events/trace atomically at completion
```

Advantages:

```text
avoids enormous transaction across entire simulation
prevents half-written event streams
```

But crash/interruption recovery becomes weaker.

Alternative:

```text
incremental append during run
```

supports recovery but adds more complexity.

For 1.5 GPT prefers:

```text
short/medium Experience
→ execute in memory
→ atomic final commit
```

with structured operational logs during execution.

Long-running checkpoint/recovery can be introduced later when Evolution requires it.

Claude should review this carefully.

---

# 37. User-Cancelled Runs

Question:

Should 1.5 allow cancellation?

GPT recommends basic cancellation if runs can exceed a few seconds.

Potential:

```text
RUNNING
→ CANCELLED
```

However, architecture currently named Experience statuses may not include CANCELLED.

Could instead reserve cancellation for a higher-level EvaluationRun object.

Claude should decide whether 1.5 needs a first-class:

```text
EvaluationRun
```

distinct from immutable final Experience.

---

# 38. EvaluationRun Question

A useful separation may be:

```text
EvaluationRun
= mutable execution job/process

Experience
= immutable completed scientific result
```

Conceptually:

```text
EvaluationRun
DRAFT/RUNNING/COMPLETED/CANCELLED/FAILED

on successful completion
→ emits immutable Experience
```

This mirrors:

```text
EvolutionRun
vs
Experience
```

and avoids forcing mutable runtime concerns onto Experience itself.

GPT believes this is architecturally cleaner than making Experience double as both job and result.

Claude should evaluate this as a major design question.

---

# 39. UI — Arenas

The current Arenas page is mostly scaffold.

1.5 should allow:

```text
create Arena draft/version
configure:
  symbol
  period
  timeframe
  initial capital
  execution policy
  reward policy

inspect Arena versions

run selected Entity
```

No modal-heavy flow.

Use:

```text
Workspace
Inspector
flyouts
```

consistent with the frontend system.

---

# 40. UI — Root Entity Configuration

Need a deliberate way to configure:

```text
strategy type
trait values
```

before first execution.

Potential:

```text
Inspector → Strategy section
```

for draft/unfinalized Entity.

Once birth traits are finalized:

```text
read-only
```

and variation must create a new Entity.

No raw JSON editor.

Use strategy-schema-driven fields.

---

# 41. UI — Run Interaction

Potential Arena Workspace action:

```text
Run Evaluation
```

or Entity action:

```text
Evaluate
```

opens/uses a flyout to select:

```text
Arena version
```

then starts EvaluationRun.

No blocking modal unless confirmation is needed for destructive behavior, which evaluation is not.

---

# 42. UI — Experience Inspector

After completion:

```text
Summary
Reward
Hard Gates
Performance
Trades
Equity / Drawdown
Events
Research Provenance
```

The result should answer:

```text
What did the Entity do?
When?
Why?
What happened financially?
What failed/passed?
Why did it receive this Reward?
What data/policies generated the result?
```

---

# 43. UI — Replay

The original application had "Replay."

In the new architecture, replay should mean:

```text
visual inspection of an immutable Experience
```

not a separate simulation concept.

Potential:

```text
Experience
→ Replay view
```

show:

```text
market chart
fills
position/exposure
equity
drawdown
decision markers
ExperienceEvents
```

This could live as a flyout or dedicated Workspace sub-view.

Claude should comment on whether replay belongs in 1.5 or can follow in 1.5.x.

---

# 44. UI — Chart Reuse

The Live chart already supports:

```text
range
line/candle
hover
pan/zoom
mouse details
```

The Experience replay chart should reuse the shared chart primitives where possible but consume immutable snapshot data instead of Live provider data.

Do not duplicate chart engines.

---

# 45. Minimum Baseline Strategy

GPT recommends exactly one baseline strategy family in 1.5.

Potential:

```text
Moving Average Cross
```

Traits:

```text
fast_window
slow_window
target_exposure
```

Rule:

```text
fast MA > slow MA
→ target exposure

otherwise
→ cash
```

This gives us:

```text
multiple meaningful traits
deterministic behavior
easy validation
easy mutation later
easy visual explanation
```

Alternative suggestions welcome.

---

# 46. Strategy Trait Schema

Each strategy definition should expose trait metadata:

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

This later supports:

```text
root Entity configuration UI
Evolution mutation bounds
validation
portable serialization
```

Avoid strategy-specific form code spread throughout frontend.

---

# 47. Evolution Compatibility

Although Evolution is not implemented in 1.5, the Strategy contract must support future proposer/mutation systems.

Evolution should eventually produce:

```text
TraitProposal
```

for a known:

```text
strategyType/version
```

then birth a new Entity from those validated traits.

It should not generate arbitrary executable code.

---

# 48. Strategy Extensibility

Paper Lab should be able to add a strategy type later without changing:

```text
Entity identity model
Arena execution engine
Experience persistence model
Reward engine
Evolution lifecycle
```

Only add:

```text
StrategyDefinition
Trait schema
possibly strategy-specific state
```

This is an important acceptance criterion.

---

# 49. Research Reproducibility Checklist

For every completed Experience, Paper Lab should be able to answer:

```text
Which Entity?
Which immutable traits?
Which strategy implementation?
Which Arena version?
Which exact market-data snapshot?
Which execution assumptions?
Which Reward policy?
Which engine version?
Which decisions occurred?
Which fills occurred?
How did equity evolve?
Which hard gates passed/failed?
Why is the Experience considered research-valid?
```

No hidden state.

---

# 50. Proposed Internal Module Direction

Directional only:

```text
src/domain/
  strategy/
  arena/
  experience/
  execution/
  reward/

src/application/
  evaluation/

src/infrastructure/
  market-data/
  persistence/

src/frontend/
  arenas/
  experiences/
  replay/
  domain-ui/
```

Do not create directories simply to satisfy this diagram if the implementation is cleaner another way.

---

# 51. Risk Tier

Most of 1.5 is Tier 3.

```text
Strategy contract             Tier 3
Execution engine              Tier 3
Experience generation         Tier 3
Reward/hard-gate execution    Tier 3
MarketDataSnapshot use        Tier 3
Replay visualization          Tier 2
Arena UI                      Tier 2
Entity configuration UI       Tier 2/3 boundary
```

This milestone should receive targeted Codex review after implementation, especially:

```text
lookahead prevention
fill ordering
Reward correctness
event ordering
persistence atomicity
reproducibility stamps
```

---

# 52. Proposed Implementation Passes After Design Closure

If the design converges:

```text
Pass A — Strategy contract + baseline strategy
Pass B — Arena/Execution/Reward policies
Pass C — Evaluation engine + Experience persistence
Pass D — Arena + root Entity configuration UI
Pass E — Experience Inspector + replay
Pass F — reproducibility tests / hard-gate tests / documentation
Pass G — targeted Codex review
```

---

# 53. Questions for Claude

## Q1 — Entity Strategy Contract

Do you agree an executable Entity should be defined by:

```text
strategyType
strategyVersion
immutable validated traits
```

with behavior supplied by a registered StrategyDefinition?

---

## Q2 — Root Entity configuration

Which model do you prefer:

```text
A. separate EntityDraft
```

or:

```text
B. Candidate with configuration_status DRAFT / READY
```

before immutable birth traits are finalized?

Or another model?

---

## Q3 — Baseline strategy

Is Moving Average Cross a good first strategy family for validating the architecture?

If not, what deterministic baseline would better exercise the system without adding unnecessary complexity?

---

## Q4 — Action model

Do you agree V1 Strategy should emit:

```text
TARGET_POSITION
```

rather than low-level BUY/SELL orders?

---

## Q5 — Long-only vs long/short

Should 1.5 begin:

```text
long-only
```

or support:

```text
long/short
```

immediately?

GPT prefers long-only unless a concrete architecture reason requires shorting now.

---

## Q6 — Single-symbol Arena

Do you agree 1.5 should execute one tradable symbol per Arena while keeping the contract extensible to multiple instruments later?

---

## Q7 — Policy separation

Do you agree with explicit versioned:

```text
Arena
ExecutionPolicy
RewardPolicy
```

rather than embedding every execution/scoring constant directly in Arena?

---

## Q8 — Fill timing

Do you agree with:

```text
observe completed bar t
→ decide
→ execute at bar t+1 open
```

as the default V1 fill model?

---

## Q9 — Terminal liquidation

Should every Experience force liquidation at the end?

If yes, what deterministic terminal price rule should V1 use?

---

## Q10 — ExperienceEvent taxonomy

Is the proposed event set too verbose, too small, or approximately right?

```text
EXPERIENCE_STARTED
DECISION_EMITTED
ORDER_CREATED
ORDER_REJECTED
FILL_EXECUTED
POSITION_CHANGED
FORCED_LIQUIDATION
HARD_GATE_TRIGGERED
EXPERIENCE_COMPLETED
EXPERIENCE_FAILED
```

---

## Q11 — ExperienceTrace

Should immutable time-series execution state live in a dedicated:

```text
ExperienceTrace
```

artifact rather than creating state-update ExperienceEvents at every bar?

GPT prefers yes.

---

## Q12 — Experience status

Do you agree:

```text
COMPLETED
```

may still have failed hard gates,

while:

```text
FAILED
```

means the evaluation itself could not validly complete?

---

## Q13 — EvaluationRun

Should we introduce:

```text
EvaluationRun
```

as mutable execution-job state and reserve Experience for immutable completed research results?

GPT currently thinks this is cleaner.

---

## Q14 — Persistence

For 1.5, do you agree with:

```text
execute simulation in isolated memory
→ atomically persist final Experience/events/trace
```

rather than incrementally persisting every step?

---

## Q15 — Replay

Should Experience Replay ship inside `1.5.0`, or is it acceptable as `1.5.x` immediately after the executable backend loop is verified?

---

## Q16 — Benchmark

For a single-symbol V1 Arena, is:

```text
buy-and-hold over the same snapshot/window
```

the correct default benchmark for excess return?

---

## Q17 — Fractional shares

Should V1 simulated execution allow fractional quantities?

---

## Q18 — Indicators

Do you agree with:

```text
shared deterministic indicator library
```

rather than reimplementing indicators inside each StrategyDefinition?

---

## Q19 — Scope

Is this the correct milestone boundary for 1.5, or should any major component be deferred/added before implementation?

---

# 54. Requested Claude Role

Please engage as a **peer architect**, not merely implementation reviewer.

Challenge:

```text
strategy abstraction
simulation correctness
lookahead risks
execution realism
research validity
state boundaries
reproducibility
future Evolution compatibility
```

The goal is not to preserve GPT's proposed structures.

The goal is to converge on the simplest research engine that can later support:

```text
Memory
Evolution
Promotion
Benchmarking
```

without requiring a fundamental rewrite.

---

# 55. Requested Response

Please respond:

```text
ACCEPT
ACCEPT WITH REFINEMENTS
DISAGREE
```

and classify findings:

```text
BLOCKER
HIGH
MEDIUM
LOW
SUGGESTION
```

Please answer Q1–Q19 explicitly.

If substantial design disagreement remains, ask follow-up questions and continue the peer-design round.

No `1.5.0` implementation should begin until this executable-research design is closed.
