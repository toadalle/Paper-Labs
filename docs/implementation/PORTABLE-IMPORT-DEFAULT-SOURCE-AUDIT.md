# Portable Research — Pass 0 Default Source Audit

**Baseline:** Paper Lab 1.5.2  
**Target milestone:** 1.6.0 — Portable Research  
**Status:** PASS 0 COMPLETE — prerequisites resolved for Pass A  
**Scope:** create-time defaults and generated/protected fields for V1 PLPS Entity, Arena, and Bundle planning.

## 1. Gate

Portable Import must not own a second set of defaults. Every omitted create-time value used by PLPS must resolve from canonical backend/domain state that is also available to schema discovery.

Pass 0 found no default that exists **only** in the frontend. It did find that Arena defaults, while backend-owned, were scattered across `ArenaService`, the HTTP route, and frontend placeholder strings. That was corrected during this pass by introducing the side-effect-free `ARENA_CREATE_DEFAULTS` source in `src/domain/create-defaults.ts` and making ArenaService/UI/HTTP fallback behavior consume or defer to it.

Entity strategy trait defaults already exist in the backend `StrategyDefinition.traitDefinitions`; the current Entity Inspector duplicates those values for presentation, but PLPS will not consume the frontend copies.

## 2. Entity create-field audit

| Field / concept | PLPS create classification | Canonical source | Backend-callable? | Pass 0 result / rule |
| --- | --- | --- | --- | --- |
| `name` | Optional | `EntityService.quickCreate()` + persisted `entity_default_name` counter | Yes | Omitted name uses the same monotonic `New Entity N` allocation path. Import must not invent another counter/default-name rule. |
| `family` | Optional / nullable | `createCandidate()` | Yes | Canonical default is `null`. Explicit `null` clears when patching. |
| `lifecycleState` | Generated / protected | `createCandidate()` | Yes | Always `CANDIDATE` for V1 import creation. Not accepted in PLPS. |
| `candidateStatus` | Generated / protected | `createCandidate()` | Yes | Always `ACTIVE` for a new Candidate. Not accepted in PLPS. |
| `configurationStatus` | Generated / protected | `createCandidate()` | Yes | Always `DRAFT`; Import never auto-finalizes. |
| `strategy.type` | Optional as a whole strategy block; required when a CREATE document supplies strategy traits/configuration | `StrategyRegistry` | Yes | **No global PLPS default strategy is inferred.** A name/metadata-only create may remain a generic DRAFT. If CREATE supplies strategy data, it must identify strategy type. Selected-object PATCH may inherit the target's strategy context. |
| `strategy.version` | Required on CREATE whenever strategy type/configuration is supplied; inheritable on selected PATCH | versioned `StrategyDefinition` / `StrategyRegistry` | Yes | PLPS CREATE must not use Registry's “latest version” convenience because a long-lived portable code must not change meaning when a newer strategy version is registered. |
| `strategy.traits.fast_window` | Optional within a fully identified Moving Average Cross create/config block | `movingAverageCrossStrategy.traitDefinitions` | Yes | Canonical MAC v1 default `10`. |
| `strategy.traits.slow_window` | Optional within a fully identified Moving Average Cross create/config block | `movingAverageCrossStrategy.traitDefinitions` | Yes | Canonical MAC v1 default `30`. |
| `strategy.traits.target_exposure` | Optional within a fully identified Moving Average Cross create/config block | `movingAverageCrossStrategy.traitDefinitions` | Yes | Canonical MAC v1 default `1`. |
| `traitHash` | Generated / protected | `EntityService.finalizeConfiguration()` | Yes | Never imported. |
| lineage / origin / evolution IDs | Generated / protected | domain/application lifecycle services | Yes | Never accepted as ordinary V1 Entity import fields. Future bundle-created Variant/Evolution operations generate these through canonical commands. |
| timestamps / IDs / counters | Generated / protected | domain ID/factory/repository services | Yes | Never portable input. |

### Entity frontend note

The Inspector currently renders MAC as the only available strategy and duplicates `10 / 30 / 1` as UI seed values. Those are not PLPS defaults. The authoritative strategy defaults are already returned by `/api/strategies` through `StrategyDefinition.traitDefinitions`. When Import/schema-driven UI work reaches the frontend pass, the duplicated Inspector seed values should be replaced by strategy/schema data so the UI also stops carrying a parallel presentation copy.

This frontend cleanup is not a Pass A blocker because Import and schema discovery will use the backend StrategyRegistry, never DOM defaults.

## 3. Arena create-field audit

Pass 0 introduced the canonical source:

```text
src/domain/create-defaults.ts
→ ARENA_CREATE_DEFAULTS
```

It is deliberately side-effect free so it can be consumed by:

```text
ArenaService
HTTP/API adapters
frontend labels/placeholders
PLPS schema discovery
Import planner
future LLM tooling
```

| Field / concept | PLPS create classification | Canonical source | Default / behavior | Pass 0 result / rule |
| --- | --- | --- | --- | --- |
| `name` | Required | `ArenaService.create()` validation | none | Missing is an error. |
| `symbol` | Required | `ArenaService.create()` validation | none | Missing is an error. |
| `start` | Required | `ArenaService.create()` normalization | none | Missing/invalid is an error. |
| `end` | Required | `ArenaService.create()` normalization | none | Missing/invalid is an error; must be after start. |
| `timeframe` | Optional | `ARENA_CREATE_DEFAULTS.timeframe` | `1Day` | Schema discovery reports the default and allowed V1 value. UI may still ask explicitly. |
| `initialCapital` | Optional | `ARENA_CREATE_DEFAULTS.initialCapital` | `10000` | Canonicalized. |
| `warmupBars` | Optional | `ARENA_CREATE_DEFAULTS.warmupBars` | `200` | Canonicalized; strategy-required warmup may still exceed Arena-requested warmup during evaluation. |
| `commissionPerTrade` | Optional | `ARENA_CREATE_DEFAULTS.commissionPerTrade` | `0` | Canonicalized. |
| `slippageBps` | Optional | `ARENA_CREATE_DEFAULTS.slippageBps` | `1` | Canonicalized. |
| `rewardLambda` | Optional | `ARENA_CREATE_DEFAULTS.rewardLambda` | `1` | Canonicalized. |
| `maxDrawdownGate` | Optional | `ARENA_CREATE_DEFAULTS.maxDrawdownGate` | `0.35` | Canonicalized. |
| `minimumTradeCount` | Optional | `ARENA_CREATE_DEFAULTS.minimumTradeCount` | `1` | Canonicalized. |
| `feed` | Environment-derived / not PLPS v1 portable input | server `config.alpacaHistoricalFeed` | environment setting, default `iex` | Exclude from V1 portable Arena schema. Snapshot provenance records what was actually used. ImportPlan PREPARE must surface the resolved snapshot/feed provenance so a caller can see this environmental consequence. |
| `assetClass` | Generated / fixed V1 | ArenaService snapshot request | `US_EQUITY` | Not a PLPS v1 field until the domain supports other Arena asset classes. |
| snapshot adjustment mode | Generated / fixed V1 | ArenaService snapshot request | `split` | Not user-importable V1. |
| `baseArenaId` | Context-derived / protected | selected Arena import context | none | Never portable payload identity. Planner derives PATCH vs CREATE_VERSION target from selected context. |
| Arena `id`, `rootArenaId`, `version`, `createdAt` | Generated / protected | ArenaService/repository | generated | Never imported. |
| ExecutionPolicy fill model | Generated / fixed V1 | ArenaService | `NEXT_BAR_OPEN` | Not independently portable until a supported policy schema exposes alternatives. |
| terminal liquidation | Generated / fixed V1 | ArenaService | `FINAL_BAR_CLOSE` | Same. |
| fractional shares | Generated / fixed V1 | ArenaService | `true` | Same. |
| long-only | Generated / fixed V1 | ArenaService | `true` | Same. |
| max exposure | Generated / fixed V1 | ArenaService | `1` | Same. |
| Reward benchmark | Generated / fixed V1 | ArenaService | `BUY_AND_HOLD` | Same. |
| Reward max-exposure gate | Generated / fixed V1 | ArenaService | `1` | Same. |
| execution-validity/data-integrity gates | Generated / fixed V1 | ArenaService | `true` | Same. |

## 4. Arena version-patch environmental note

The current Arena stores the resulting immutable MarketDataSnapshot reference rather than a reusable portable `feed` field. Therefore a future selected-Arena `CREATE_VERSION` plan that changes only a scalar such as `start` will prepare its new snapshot using the **current server historical-feed configuration**.

This does not violate PLPS's “omitted portable fields are preserved” rule because feed is not a V1 portable Arena field, but it is an environmental consequence that must not be hidden.

Required Pass D behavior:

```text
ImportPlan Preview
→ show resolved provider/feed/snapshot preparation policy
```

If future product requirements demand feed itself be portable/inherited as Arena configuration, that requires an explicit Arena/data-policy design change rather than an Import-only field.

## 5. Bundle defaults

`kind=bundle` defines no independent domain defaults.

Each contained object's missing/default semantics resolve through that object's canonical schema:

```text
Entity object
→ Entity create/patch schema

Arena object
→ Arena create/version schema
```

Bundle planner must not normalize fields with a separate bundle-default layer.

Bundle-only planner concepts such as aliases, dependency ordering, plan IDs, hashes, and correlation IDs are generated planner metadata, not user-domain defaults.

## 6. Evolution

Evolution is not an implemented V1 PLPS object in the initial `1.6.0 Portable Research` gate. No Evolution create-default audit is required before Pass A.

When `kind=evolution` becomes implementable, it must receive its own Default Source Audit before schema support is enabled. The existing `defaultEvolutionPolicy()` is not automatically declared the portable Evolution default simply because it exists; the future Evolution milestone must decide which fields are required, inherited, generated, or canonical defaults in the actual application workflow.

## 7. Strict create semantics resolved by Pass 0

### Entity CREATE

Allowed:

```text
metadata-only partial spec
→ generic Candidate / DRAFT
```

Allowed:

```text
strategy type + explicit strategy version + partial traits
→ omitted traits use that immutable StrategyDefinition version's canonical trait defaults
→ Candidate remains DRAFT
```

Rejected:

```text
traits supplied without strategy identity
```

Rejected:

```text
strategy type supplied for CREATE without explicit version
```

This avoids a portable document silently changing behavior when future strategy versions are registered.

### Selected Entity PATCH

A selected DRAFT/READY target already supplies strategy context, so a partial trait patch may omit type/version when the operation semantics allow it.

### Arena CREATE

Required:

```text
name
symbol
start
end
```

Optional canonical defaults:

```text
timeframe
initialCapital
warmupBars
commissionPerTrade
slippageBps
rewardLambda
maxDrawdownGate
minimumTradeCount
```

Environment-owned snapshot feed is not a PLPS v1 field.

## 8. Canonical-default cleanup completed in Pass 0

Changed:

```text
ADDED
src/domain/create-defaults.ts

UPDATED
src/application/services/arena-service.ts
src/server/routes.ts
src/frontend/pages/arenas.ts
src/frontend/main.ts
```

Effect:

```text
ArenaService
frontend Arena default labels
frontend timeframe fallback
future PLPS schema discovery
```

now have one reusable canonical Arena default source instead of independently owning numeric/string defaults.

The HTTP route no longer injects its own `1Day` fallback before ArenaService; if timeframe is omitted, canonicalization happens in the service/default source.

## 9. Pass 0 verification checklist

- [x] Entity generated defaults originate in backend factory/application services.
- [x] Entity strategy trait defaults originate in versioned backend StrategyDefinition metadata.
- [x] PLPS CREATE will not infer an unstable “latest strategy version.”
- [x] Traits-without-strategy-context CREATE semantics explicitly rejected.
- [x] Arena required fields identified.
- [x] Arena optional defaults centralized in a side-effect-free backend/domain source.
- [x] HTTP Arena adapter no longer owns its own timeframe default.
- [x] Arena frontend placeholders consume the same canonical default source.
- [x] Environment-owned feed distinguished from portable object configuration.
- [x] Bundle has no separate object-default system.
- [x] Evolution default audit deferred until Evolution becomes a supported portable kind.
- [x] No Import-specific default object/function is required.

## 10. Pass 0 conclusion

**PASS. Pass A may begin.**

The Portable Research implementation may now build PLPS v1 schema/parser/discovery against canonical sources without inventing a parallel default system.

The first permanent compatibility fixtures should encode the create rules above so future PLPS v1 decoders preserve these semantics.
