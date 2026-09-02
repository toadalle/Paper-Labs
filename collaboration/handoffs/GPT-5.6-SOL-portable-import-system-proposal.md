# Paper Lab — Portable Import / Patch / Bundle System Proposal

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T14:35:00-05:00  
**Thread:** architecture / API / frontend / portability / testing  
**Status:** proposal — Claude peer-architect review requested  
**Current baseline:** `paper_labs_1.5.2.zip`  
**Proposed milestone:** major feature after current executable-research stabilization  
**Implementation:** NOT started

---

# 1. User Intent

The user wants Paper Lab to support **portable import codes** for research objects.

The same portable code should be usable in different UI contexts:

```text
Objects-panel Import
→ create a new object

Selected-object Import
→ patch / update the selected object
```

The user explicitly wants this for:

```text
Entities
Arenas
Evolution
```

and eventually for more advanced packages such as:

```text
multiple Entities

Arena + Entities

Evolution configuration + initial population

multi-object research setups
```

The user also wants partial codes.

Example:

```text
selected Arena
+
import code containing only:
  start = 2025-01-01

→ only start changes
```

This is particularly valuable because the application is being designed so an LLM can eventually operate the backend through structured API calls.

The import system should therefore become:

> **a portable, versioned, declarative object-specification layer shared by humans, LLMs, UI import flows, and future API automation.**

It should not be a special-purpose UI parser disconnected from the domain/application layer.

---

# 2. Core Design Goal

We need one representation that can describe:

```text
CREATE intent
PATCH intent
BUNDLE intent
```

without requiring the code itself to know where it will be applied.

The UI context determines execution semantics.

Example:

```text
same Entity code
```

used here:

```text
Objects → Import
```

means:

```text
create a new Entity from the supplied fields
```

Used here:

```text
selected Entity → Import
```

means:

```text
apply supplied fields to that selected Entity
subject to domain immutability rules
```

The code itself stays portable.

---

# 3. Proposed Name

Working architectural name:

```text
Paper Lab Portable Specification
PLPS
```

A user-facing label can remain:

```text
Import Code
```

Examples:

```text
Import Entity
Import Arena
Import Setup
```

The internal specification should have a proper versioned name so it does not become an unstructured collection of ad hoc JSON snippets.

Alternative names welcome.

---

# 4. Fundamental Principle

Import does **not** bypass normal application/domain rules.

Import is merely another command surface.

Conceptually:

```text
UI Form
API
Import Code
LLM Tooling
```

all eventually call:

```text
Application Services
        ↓
Domain validation
        ↓
Persistence / Audit
```

Never:

```text
Import parser
→ direct repository/database mutation
```

---

# 5. Canonical Format

GPT recommends a **human-readable JSON document** as the canonical format.

Example:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "entity",
  "spec": {
    "name": "Momentum Test",
    "strategy": {
      "type": "moving_average_cross",
      "version": 1,
      "traits": {
        "fast_window": 10,
        "slow_window": 30,
        "target_exposure": 1
      }
    }
  }
}
```

Reasons to prefer JSON initially:

```text
easy for LLMs to generate
easy for users to copy/paste
easy to inspect before applying
easy to validate with schemas
easy to diff
portable across languages
maps directly to API payload concepts
does not require custom parser grammar
```

Do not begin with opaque Base64 as the canonical representation.

An optional compressed/share form can be added later:

```text
PLPS1:<encoded payload>
```

but decoding must always resolve back to the canonical JSON document.

---

# 6. Versioned Envelope

Every import document needs an explicit envelope:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "entity",
  "spec": {}
}
```

Required:

```text
format
version
kind
spec
```

Potential `kind` values:

```text
entity
arena
evolution
bundle
```

Future:

```text
evaluation-suite
execution-policy
reward-policy
benchmark
family
research-package
```

Unknown format/version:

```text
reject clearly
```

Never silently reinterpret.

---

# 7. Context Determines Operation

The import code should generally not contain:

```text
"operation": "create"
```

or:

```text
"operation": "patch"
```

because the user specifically wants the same code to work in multiple places.

Instead:

```text
Import surface
→ determines execution mode
```

Examples:

```text
Entities object panel Import
+ kind=entity
→ CREATE_ENTITY
```

```text
selected DRAFT Entity Import
+ kind=entity
→ PATCH_ENTITY
```

```text
Arenas object panel Import
+ kind=arena
→ CREATE_ARENA
```

```text
selected Arena Import
+ kind=arena
→ PATCH_OR_VERSION_ARENA
```

This is a central proposed invariant.

---

# 8. Partial Specifications

Fields not present in `spec` mean:

```text
unspecified
```

not:

```text
reset to default
null
empty
```

Example:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "arena",
  "spec": {
    "start": "2025-01-01"
  }
}
```

When used against a selected Arena:

```text
only start is requested to change
```

All omitted fields preserve their current values.

This is essential for the user's LLM-assisted tuning workflow.

---

# 9. Explicit Null vs Missing

Need a clear distinction.

Proposed:

```text
missing property
→ leave unchanged during patch
→ use domain default during create if allowed

property = null
→ explicitly clear the field
```

But only fields whose domain model permits null may accept null.

Example:

```json
{
  "spec": {
    "family": null
  }
}
```

may clear Entity family metadata.

Trying:

```json
{
  "spec": {
    "strategy": null
  }
}
```

on a READY Entity should fail.

---

# 10. Import Preview Before Apply

Every import should first resolve into an **ImportPlan**.

Conceptually:

```text
Parse
↓
Schema Validate
↓
Resolve Context
↓
Domain Validate
↓
Build ImportPlan
↓
Preview
↓
Apply
```

The preview should tell the user:

```text
what object(s) will be created
what fields will change
what fields will remain unchanged
whether a new immutable version will be created
which supplied fields are invalid/ignored/blocked
whether dependencies will also be created
```

No mutation should occur merely from pasting code.

---

# 11. ImportPlan

Proposed application-level object:

```ts
ImportPlan {
  id
  mode
  valid
  operations[]
  warnings[]
  errors[]
}
```

An operation could be:

```ts
ImportOperation {
  objectKind
  action
  targetId?
  sourceAlias?
  changes
  consequences
}
```

Possible actions:

```text
CREATE
PATCH
CREATE_VERSION
CREATE_VARIANT
NO_OP
BLOCKED
```

This gives the UI and future LLM tooling one explainable interpretation layer.

---

# 12. Apply Must Use the Plan

To avoid preview/apply drift:

```text
Preview
→ generates normalized plan token/hash
```

Then:

```text
Apply
→ executes that exact validated plan
```

If relevant target state changed between preview and apply:

```text
plan invalidated
→ re-preview required
```

This prevents a stale import preview from applying against a different object version.

---

# 13. Entity Create Semantics

Objects-panel Entity Import:

```text
kind = entity
→ create new Entity
```

The payload may be partial.

Example:

```json
{
  "kind": "entity",
  "spec": {
    "name": "Quick Test"
  }
}
```

Result:

```text
new Candidate
configuration_status = DRAFT
name = Quick Test
```

Missing strategy fields remain the normal DRAFT defaults/empty configuration according to canonical Entity creation rules.

The normal monotonic Entity counter still advances.

Import does not create a special category of Entity.

---

# 14. Entity Patch Semantics — DRAFT

Selected DRAFT Entity + Entity code:

```text
patch supplied mutable configuration fields
```

Examples allowed:

```text
name
family
strategy type
strategy version if supported
traits
```

Example:

```json
{
  "kind": "entity",
  "spec": {
    "strategy": {
      "traits": {
        "slow_window": 50
      }
    }
  }
}
```

should update only:

```text
slow_window
```

while preserving:

```text
fast_window
target_exposure
strategy type/version
```

assuming the resulting complete draft is valid or draft validation rules permit temporarily incomplete state.

---

# 15. Entity Patch Semantics — READY

This needs an explicit architecture rule because READY birth traits are immutable.

Selected READY Entity + import containing only mutable metadata:

```text
name
family
```

may patch normally.

Selected READY Entity + import attempting to change:

```text
strategy type
strategy version
birth traits
```

must **not rewrite the Entity**.

GPT recommends the preview offer/resolve as:

```text
CREATE_VARIANT
```

rather than rejecting the entire concept.

Example:

```text
selected READY Entity
current slow_window = 30

import:
slow_window = 50
```

Preview:

```text
Cannot mutate birth traits of READY Entity.

Proposed action:
Create Variant from selected Entity
with slow_window: 30 → 50
```

The user can apply the variant creation.

This fits the evolutionary/lineage model much better than weakening immutability.

Claude should review whether V1 import should:

```text
automatically plan CREATE_VARIANT
```

or:

```text
BLOCK and require an explicit "Create Variant" action
```

GPT leans toward **plan CREATE_VARIANT but require visible confirmation**.

---

# 16. Retired Entity

Retired Entity remains historically meaningful.

Mutable metadata may follow the same rules already allowed by normal UI/application services.

Birth traits remain immutable.

Import must never resurrect a Retired Entity.

Changing lifecycle state through generic import is not recommended.

Lifecycle actions should remain explicit commands:

```text
Retire
Delete
```

not ordinary field patches.

---

# 17. Protected Fields

Portable imports should not normally accept internal identity/provenance fields such as:

```text
id
createdAt
updatedAt
traitHash
originRun
parentEntityId
candidateState
experience counts
researchValidity
audit IDs
tombstone fields
snapshot hashes
```

These are generated or domain-owned.

If present:

```text
reject as protected
```

rather than silently ignore.

This makes malformed/unsafe LLM-generated codes obvious.

---

# 18. Arena Create Semantics

Objects-panel Arena Import:

```text
kind = arena
→ create a new Arena family/version 1
```

The code may contain:

```text
name
symbol
timeframe
start
end
initial capital
warmup
ExecutionPolicy values
RewardPolicy values
```

Missing optional fields use the same explicit server defaults as the normal Arena authoring flow.

No special import defaults.

---

# 19. Arena Patch Semantics

Selected Arena + Arena code should behave according to immutability.

## If selected Arena version is still mutable/unused

Patch supplied fields on that version, subject to normal rules.

## If selected Arena version is immutable/used

Do **not** mutate it.

Instead:

```text
CREATE_VERSION
```

from the selected Arena family/version, applying only supplied fields.

Example:

```text
Arena v1
start = 2025-01-01

import:
start = 2024-01-01
```

Preview:

```text
Arena v1 is immutable because it has been used.

Create Arena v2:
start
2025-01-01 → 2024-01-01

all other fields inherited from v1
```

This directly supports the user's “show you a spread and ask you to change one field” workflow without breaking reproducibility.

---

# 20. Arena Policy Patching

Nested partial patching should work.

Example:

```json
{
  "kind": "arena",
  "spec": {
    "executionPolicy": {
      "slippageBps": 3
    }
  }
}
```

Selected used Arena:

```text
create next Arena version
inherit all Arena fields
inherit ExecutionPolicy
create/reuse policy version as appropriate
change only slippage
```

Exact policy dedup/version semantics should use existing architecture rules, not import-specific shortcuts.

---

# 21. Timeframe / Enum Validation

Import schemas should use canonical values:

```text
1Day
```

not display labels:

```text
1 Day
```

UI may render friendly labels.

LLM-facing documentation should expose allowed canonical enum values.

Invalid values:

```text
error with allowed options
```

---

# 22. Evolution Import

Evolution does not yet exist in full implementation, so its portable schema should be designed now but implemented with the Evolution milestone.

Conceptually:

```json
{
  "kind": "evolution",
  "spec": {
    "name": "MA Search",
    "policy": {
      "...": "..."
    },
    "population": {
      "...": "..."
    },
    "evaluationSuiteRef": "..."
  }
}
```

Important:

```text
importing Evolution configuration
≠ importing mutable running-state/checkpoints
```

Portable codes should describe setup/configuration, not fabricated runtime history.

Do not import:

```text
completed Experience results
survival outcomes
birth/death history
audit history
random run state
```

as ordinary configuration.

---

# 23. Bundle Imports

Advanced imports should use:

```text
kind = bundle
```

Example:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "bundle",
  "spec": {
    "objects": [
      {
        "alias": "entity.fast",
        "kind": "entity",
        "spec": {
          "name": "Fast MA",
          "strategy": {
            "type": "moving_average_cross",
            "version": 1,
            "traits": {
              "fast_window": 5,
              "slow_window": 20,
              "target_exposure": 1
            }
          }
        }
      },
      {
        "alias": "entity.slow",
        "kind": "entity",
        "spec": {
          "name": "Slow MA",
          "strategy": {
            "type": "moving_average_cross",
            "version": 1,
            "traits": {
              "fast_window": 20,
              "slow_window": 50,
              "target_exposure": 1
            }
          }
        }
      },
      {
        "alias": "arena.spy",
        "kind": "arena",
        "spec": {
          "name": "SPY 2025",
          "symbol": "SPY",
          "timeframe": "1Day",
          "start": "2025-01-01",
          "end": "2025-12-31"
        }
      }
    ]
  }
}
```

This creates several objects atomically or according to an explicit bundle transaction policy.

---

# 24. Portable References

Bundles must never depend on machine-local database IDs.

Use:

```text
alias
```

inside the bundle.

Example:

```json
{
  "alias": "evolution.primary",
  "kind": "evolution",
  "spec": {
    "initialPopulationRefs": [
      "entity.fast",
      "entity.slow"
    ],
    "arenaRefs": [
      "arena.spy"
    ]
  }
}
```

During planning:

```text
alias
→ planned/new object identity
```

After application:

```text
ImportResult
→ alias → actual ID mapping
```

This makes codes portable between installations.

---

# 25. External Existing-Object References

Sometimes a portable code may intentionally target something already present.

Avoid raw opaque database IDs where possible.

Potential reference syntax:

```json
{
  "ref": {
    "kind": "arena",
    "match": {
      "name": "Discovery Arena",
      "version": 2
    }
  }
}
```

However, name-based resolution can be ambiguous.

GPT recommends V1 bundles primarily:

```text
create and reference their own aliases
```

and defer broad existing-object lookup syntax until a real use case appears.

Selected-context patching already gives the user a safe way to target an existing object.

---

# 26. Bundle Transaction Semantics

Default bundle behavior should be **atomic**.

```text
validate every operation
↓
build complete ImportPlan
↓
if any required operation fails:
apply nothing
```

This prevents:

```text
3 Entities created
Arena failed
Evolution missing dependencies
```

from leaving partial test setups.

Potential future option:

```text
best-effort
```

should not be the default.

---

# 27. Bundle Dependency Ordering

The planner builds a dependency graph.

Example:

```text
Entities
Arena
↓
Evolution configuration references them
```

Planner determines:

```text
create Entities
create Arena
create Evolution configuration
```

Cycles:

```text
reject with explicit dependency-cycle error
```

---

# 28. Partial Bundle Patching

A bundle may eventually patch multiple selected/existing objects, but this is substantially more ambiguous.

GPT recommends V1:

```text
bundle import
→ create portable setup
```

Selected single-object import:

```text
→ patch selected object
```

Do not initially allow a single bundle to search the database and mass-patch arbitrary existing objects by names.

That can be designed later with stronger selectors and preview semantics.

---

# 29. Import UI — Objects Panel

Entities panel currently has:

```text
[ + ]
```

User wants to preserve this fast creation path.

Proposed:

```text
[ Import ] [ + ]
```

with Import immediately to the left of `+`.

The `+` remains unchanged.

Click Import:

```text
anchored import panel / workspace surface
```

not a blocking modal.

Input:

```text
Paste Import Code
```

Actions:

```text
Preview
Apply
```

Importing `kind=entity` here creates a new Entity.

Wrong kind:

```text
clear error:
"This import contains an Arena. Open Arenas to import it here,
or use a general Setup Import."
```

---

# 30. Selected Entity Import

Inside selected Entity workspace/Inspector, add:

```text
Import
```

The location should not compete visually with lifecycle actions.

Potential:

```text
Strategy / Configuration section
→ Import Configuration
```

or a compact Workspace-header action.

User specifically asked for an import button inside the selected Entity workspace.

Same Entity code now means:

```text
PATCH selected Entity
```

with DRAFT/READY rules described above.

---

# 31. Selected Arena Import

Same idea:

```text
selected Arena
→ Import
```

Pasting an Arena code:

```text
unused version
→ patch

used immutable version
→ preview next version creation
```

This should become one of the easiest ways to tune an experiment.

---

# 32. General Setup Import

Advanced bundles do not naturally belong to one object panel.

GPT proposes a general:

```text
Import Setup
```

entry point.

Possible location:

```text
top-level header utility
```

or:

```text
Console / Research setup
```

but avoid polluting the global header before testing usage.

Alternative:

```text
each relevant Objects panel Import accepts bundle
```

and routes the bundle into a full Workspace preview.

Claude should advise best surface.

---

# 33. Import Preview UI

Preview should be structured.

Example:

```text
IMPORT PREVIEW

Target
Selected Entity: First Test

Result
CREATE VARIANT

Changes
Slow Window
30 → 50

Unchanged
Fast Window        10
Target Exposure     1

Reason
Birth traits are immutable after READY.

[ Cancel ] [ Create Variant ]
```

Bundle example:

```text
CREATE
2 Entities
1 Arena
1 Evolution configuration

Dependencies
Evolution → Entities + Arena

Warnings
None

[ Apply Bundle ]
```

---

# 34. Diff Semantics

The backend should generate diffs.

Frontend should not independently infer what changed.

Normalized plan returns:

```text
old
new
path
classification
```

Example:

```text
strategy.traits.slow_window
30
50
IMMUTABLE → CREATE_VARIANT
```

This keeps frontend out of domain rules.

---

# 35. Import Errors

Errors should be precise and path-aware.

Example:

```text
spec.strategy.traits.fast_window

Expected integer >= 1.
Received: -5
```

Cross-field:

```text
spec.strategy.traits.fast_window
must be smaller than slow_window.
```

Arena:

```text
spec.start
must be earlier than spec.end.
```

Bundle:

```text
spec.objects[3].spec.initialPopulationRefs[1]
Unknown alias: entity.missing
```

This is especially important for LLM-generated codes.

---

# 36. Unknown Fields

Do **not** silently ignore unknown fields.

Example:

```text
"slipage": 5
```

should error:

```text
Unknown field "slipage".
Did you mean "slippageBps"?
```

Silent unknown-field acceptance makes LLM automation dangerous.

---

# 37. Defaults

Portable specifications should never secretly acquire a second set of defaults.

Defaults must come from canonical application/domain schemas.

Example:

```text
Arena import missing slippage
→ same default as Arena UI/API create
```

No:

```text
ImportDefaultArena
```

parallel behavior.

---

# 38. Export Codes

An import system should naturally support the reverse:

```text
Export Code
```

for existing objects.

GPT recommends designing import/export together even if import ships first.

Entity Export:

```text
portable specification for reconstructing configuration
```

Arena Export:

```text
portable configuration specification
```

Bundle Export:

```text
selected research setup
```

Do not export machine-local history/provenance as though it were portable configuration.

---

# 39. Export vs Backup

Very important distinction:

```text
Portable Export
= reconstructable configuration

Backup
= full persisted application state
```

Import Codes are not backups.

They should not attempt to restore:

```text
AuditEvent history
Experience evidence
Notification history
logs
MarketDataSnapshot binary artifacts
tombstones
```

unless a future dedicated backup/migration system explicitly supports them.

---

# 40. Provenance of Imported Objects

An imported object should remain a normal Paper Lab object.

Potential metadata:

```text
createdVia = IMPORT
```

may be useful operationally/audit-wise, but it should not become domain identity.

Audit can record:

```text
ENTITY_CREATED
source = IMPORT
import_format_version = 1
```

Same for patches/version creation.

Do not embed the entire raw code into every domain object.

---

# 41. Import Audit

Material state mutations must still produce normal authoritative AuditEvents.

Examples:

```text
ENTITY_CREATED
ENTITY_CONFIGURATION_UPDATED
ENTITY_FINALIZED
ARENA_CREATED
ARENA_VERSION_CREATED
EVOLUTION_CREATED
```

with optional import context.

The Import system itself may also emit a summary audit:

```text
IMPORT_APPLIED
```

but should not replace domain-specific mutation audits.

Claude should review whether this summary event is useful or redundant.

---

# 42. Security / Capability Boundary

Eventually an LLM may post portable specs.

Therefore imports need a strict capability model.

A portable code must not contain:

```text
arbitrary executable code
SQL
filesystem paths
HTTP URLs to execute
shell commands
provider credentials
API keys
JavaScript expressions
```

PLPS is declarative data only.

Strategy types must be registered Paper Lab strategy types.

---

# 43. LLM Compatibility

This feature should become the natural LLM command substrate.

Example user conversation:

```text
User:
Tune this Entity for a slower crossover.

LLM:
returns portable patch:
slow_window = 50
```

The LLM does not need to know:

```text
database ID
repository layout
SQL schema
UI internals
```

Selected UI context supplies the target.

This is exactly why partial specifications are important.

---

# 44. Future API Shape

Potential endpoints:

```text
POST /api/import/preview
POST /api/import/apply
```

Preview request:

```json
{
  "document": { "...": "..." },
  "context": {
    "surface": "ENTITY",
    "targetId": "entity_..."
  }
}
```

Response:

```text
ImportPlan
```

Apply:

```json
{
  "planId": "...",
  "planHash": "..."
}
```

The same endpoints can later support:

```text
web UI
LLM tooling
CLI
automation
```

---

# 45. Schema Discovery for LLMs

Future endpoint:

```text
GET /api/import/schema
```

or more specific:

```text
GET /api/import/schema/entity
GET /api/import/schema/arena
```

Returns allowed:

```text
fields
types
enums
constraints
descriptions
nested structures
```

This allows an LLM integration to ask the backend what it supports instead of relying on hard-coded prompt knowledge.

This is strongly recommended.

---

# 46. Schema Versioning

`PLPS version` is not necessarily the same as:

```text
product version
strategy version
Arena version
ExecutionPolicy version
```

Example:

```text
PLPS v1
```

may remain stable across many Paper Lab releases.

If PLPS v2 is introduced:

```text
old v1 decoder remains supported
```

within a deliberate compatibility policy.

The project is currently still in development and historically does not maintain arbitrary old product formats, but portable codes become user-facing artifacts and may deserve stronger compatibility guarantees than ordinary internal storage.

Claude should explicitly decide this policy.

---

# 47. Canonical Serialization

For exports and tests:

```text
stable property ordering
normalized numeric representation
canonical enum values
UTF-8
```

This enables:

```text
reliable diffs
golden fixtures
LLM comparison
optional content hashes
```

---

# 48. Optional Code Hash

Potential envelope:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "entity",
  "spec": {},
  "metadata": {
    "label": "MA 10/30"
  }
}
```

A hash could be calculated externally/canonically for integrity, but GPT does not think V1 needs a user-visible checksum unless codes are compressed/shared through transport that can corrupt them.

Do not overengineer cryptographic signing in V1.

---

# 49. Import Metadata

Optional non-domain metadata could include:

```text
label
description
authoringTool
createdAt
```

But importing these should not mutate domain fields unless explicitly mapped.

Potentially omit metadata entirely in V1 to keep codes minimal.

Claude should review.

---

# 50. Object-Specific Schemas

Avoid one enormous loose schema.

Use:

```text
PortableEntitySpec
PortableArenaSpec
PortableEvolutionSpec
PortableBundleSpec
```

with a shared envelope.

Each maps deliberately into application commands.

---

# 51. Nested Patch Semantics

Use recursive merge semantics for known structured objects.

Example current Entity:

```json
{
  "strategy": {
    "type": "moving_average_cross",
    "version": 1,
    "traits": {
      "fast_window": 10,
      "slow_window": 30,
      "target_exposure": 1
    }
  }
}
```

Patch:

```json
{
  "strategy": {
    "traits": {
      "slow_window": 50
    }
  }
}
```

Result:

```text
fast_window = 10
slow_window = 50
target_exposure = 1
```

Do not replace the whole `traits` object merely because the key exists.

---

# 52. Arrays Need Explicit Semantics

Recursive merge is dangerous for arrays.

For V1:

```text
array field supplied
→ replace entire array
```

unless that field defines a specific operation.

Example Evolution initial population:

```text
initialEntityRefs
```

supplied array replaces the draft configuration list.

Future additive operators:

```text
append
remove
```

should use explicit syntax, not magical merge behavior.

---

# 53. Patch Operators

Do not introduce JSON-Patch-style operators immediately unless required.

The user's common use case:

```text
change this one scalar field
```

is satisfied by partial nested specs.

If future needs require:

```text
remove one item from list
increment value
append dependency
```

then define explicit versioned patch operations later.

Keep V1 understandable.

---

# 54. Create Completeness

A partial code pasted into a **create** surface may not contain enough information for a fully READY object.

That is acceptable when the domain supports draft creation.

Example:

```text
Entity partial code
→ create DRAFT Entity
```

Arena may not support incomplete persisted drafts.

Therefore:

```text
Arena create import
```

must either:

```text
contain all required Arena creation fields
```

or fail preview with missing-field errors.

Do not silently invent required experimental conditions.

---

# 55. Update Completeness

Patch should validate the **resulting merged object**, not only the supplied fields.

Example:

```text
current:
fast = 10
slow = 30

patch:
fast = 40
```

Result would violate:

```text
fast < slow
```

Therefore preview fails even though `40` is individually a valid integer.

---

# 56. Finalization Is Separate

Importing configuration into a DRAFT Entity should not automatically finalize it unless the user explicitly asks for that behavior.

The user wants import as a fast tuning mechanism.

So:

```text
Objects Import Entity code
→ DRAFT by default
```

even if complete.

Selected DRAFT patch:

```text
remains DRAFT
```

Then user can:

```text
Finalize Configuration
```

This preserves the intentional birth-trait lock transition.

Potential bundle flag:

```text
finalize: true
```

is tempting but GPT recommends **not** adding it in V1.

Keep lifecycle commands separate from configuration import.

Claude should review this.

---

# 57. Arena Snapshot Capture

Importing an Arena specification should not automatically:

```text
capture MarketDataSnapshot
```

unless the user explicitly triggers creation workflow that already defines capture as part of Arena creation.

Current Arena UI uses:

```text
Capture Snapshot & Create
```

Need architectural clarity:

```text
Portable Arena Spec
= configuration

Arena creation application command
= may resolve/capture snapshot
```

Import should call the same canonical Arena create command as UI.

It should not contain serialized market-data payloads.

---

# 58. Evolution Bundle Example

Desired future experience:

User asks GPT:

> Give me a test setup with six Moving Average Entities across one SPY Arena.

GPT returns one bundle.

Paper Lab preview:

```text
CREATE

Entities
6

Arenas
1

Evolution setups
1

Entity configurations
MA 5/20
MA 10/30
MA 20/50
...

Arena
SPY
1Day
2025-01-01 → 2025-12-31

Evolution
Population = imported six Entities
```

Apply once.

This is exactly the testing-speed benefit the user wants.

---

# 59. Same-Code Context Example

One Entity code:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "entity",
  "spec": {
    "strategy": {
      "traits": {
        "slow_window": 50
      }
    }
  }
}
```

## Objects-panel Import

No target exists.

Result:

```text
create New Entity N
Candidate / DRAFT
slow_window = 50
other configuration follows canonical draft defaults/state
```

Potential issue:

If creating an Entity with only one nested trait but no strategy type creates an ambiguous object, planner may need to infer the default baseline strategy only if default strategy is canonical.

Claude should decide whether partial create can use canonical defaults or requires enough type context.

## Selected DRAFT Entity

Result:

```text
patch slow_window only
```

## Selected READY Entity

Result:

```text
preview CREATE_VARIANT
slow_window only changed from parent's birth traits
```

This illustrates why context-sensitive planning is central.

---

# 60. General Import vs Object Import

Potential UI hierarchy:

```text
Entity Objects
[ Import ] [ + ]

Arena Objects
[ Import ] [ + ]

Evolution Objects
[ Import ] [ + ]
```

Each object Import defaults to the relevant kind.

A bundle pasted there can still be recognized and redirected to:

```text
Setup Import Preview
```

Selected object:

```text
Import
```

means patch/variant/version target context.

This keeps ordinary object-specific workflows fast.

---

# 61. Clipboard / File Support

V1 should support:

```text
paste text
```

Potential immediate addition:

```text
Load .json
```

is cheap but not essential.

Do not invent a custom binary extension.

Future:

```text
.paperlab.json
```

could be useful if users begin sharing larger bundles.

Claude should review whether file import belongs in first milestone.

---

# 62. Portable Code Documentation

Paper Lab should include canonical documentation with examples:

```text
Entity create
Entity partial patch
Arena create
Arena one-field patch
Bundle
```

This documentation is also what GPT/Claude can use to generate codes accurately.

Potential endpoint/UI:

```text
Copy Schema
Copy Example
```

later.

---

# 63. Testing Strategy

Required unit/schema tests:

```text
valid envelope
unknown version rejected
unknown kind rejected
unknown field rejected
protected field rejected

missing vs null semantics

nested partial merge
array replacement semantics

cross-field validation after merge
```

---

# 64. Entity Import Tests

```text
Objects import creates new DRAFT Entity

selected DRAFT import patches only supplied fields

failed patch preserves original Entity

selected READY mutable metadata patch succeeds

selected READY trait patch never mutates original

READY trait patch produces/requests CREATE_VARIANT

Retired Entity import cannot resurrect lifecycle

protected identity fields rejected

normal Entity counter remains monotonic
```

---

# 65. Arena Import Tests

```text
Objects import creates Arena

missing required creation fields rejected

selected unused Arena patches supplied field only

selected used Arena is never mutated

selected used Arena patch creates next version

one-field start-date patch preserves all other fields

nested ExecutionPolicy patch creates correct resulting policy

resulting start/end validation runs

snapshot/provenance behavior remains canonical
```

---

# 66. Bundle Tests

```text
aliases resolve

local IDs never required

dependency order deterministic

unknown alias rejected

dependency cycle rejected

bundle application atomic

one failed object → nothing created

ImportResult returns alias → actual ID map
```

---

# 67. Preview / Apply Concurrency Tests

```text
preview plan created

target changes before apply

apply rejects stale plan

re-preview generates new diff
```

Especially important for future LLM/API automation.

---

# 68. Security Tests

Reject payload fields attempting:

```text
script
code
url execution
SQL
filesystem
credentials
provider token
arbitrary strategy implementation
```

Large payload limits should exist to avoid denial-of-service style parsing.

---

# 69. ImportResult

On success:

```ts
ImportResult {
  planId
  operations[]
  createdIds[]
  updatedIds[]
  createdVersions[]
  aliasMap
  warnings[]
}
```

UI can then:

```text
select newly created object
navigate to it
show SUCCESS notification
```

Bundle may present summary:

```text
6 Entities created
1 Arena created
1 Evolution setup created
```

---

# 70. Failure Atomicity

Single-object patch:

```text
validate
→ mutate + required AuditEvent atomically
```

Bundle:

```text
entire bundle atomic
```

unless architecture makes external snapshot capture impossible to transact as one database operation.

If Arena import needs external market-data retrieval, we may need:

```text
prepare external immutable artifacts
↓
validate all
↓
atomic domain commit
```

Claude should inspect this boundary carefully.

---

# 71. Market Data / External Side Effects

A bundle containing an Arena may trigger market-data capture.

That means bundle atomicity across:

```text
remote provider retrieval
database commit
```

cannot be a literal single transaction.

Proposed:

```text
PLAN

PREPARE
- fetch/normalize required market data
- create temporary/content-addressed immutable artifacts

VALIDATE

COMMIT
- persist object graph atomically
- reference prepared artifacts

CLEANUP
- remove unused prepared artifacts if commit fails
```

Or reuse existing snapshot content-addressing so unused prepared snapshots are harmless/rebuildable.

This is likely a Tier-3 architecture point.

---

# 72. Tier Classification

Proposed:

```text
PLPS schema / parser                 Tier 2
Import preview UI                    Tier 2
Object context routing               Tier 2

Entity DRAFT patch                   Tier 2/3
READY → Variant planning             Tier 3
Arena immutable-version planning     Tier 3

Bundle dependency graph              Tier 3
Bundle atomic application            Tier 3
Market-data preparation boundary     Tier 3

LLM/API import endpoints             Tier 3
```

This deserves Claude design review before implementation.

---

# 73. Suggested Milestone

This should be a real milestone rather than a 1.5.x UI patch.

Potential:

```text
1.6.0 — Portable Research Specifications
```

However, the previously discussed roadmap tentatively placed Market Memory at 1.6.

Version number should follow actual project priority rather than old placeholder roadmap labels.

Potential milestone name:

```text
Portable Research
```

or:

```text
Research Import / Automation Contract
```

Claude should advise whether to insert this before Market Memory because it materially accelerates all future testing and LLM-driven workflows.

GPT currently recommends **yes**.

---

# 74. Why Build This Before Evolution

This system becomes increasingly valuable as object complexity grows.

Building it before Evolution means:

```text
Evolution schemas can be designed portable from birth
```

rather than:

```text
build Evolution-specific forms/API
then retrofit portability later
```

It also lets GPT/Claude generate:

```text
Entities
Arenas
test setups
```

immediately, making later engine testing much faster.

This feature is therefore infrastructure for future development, not merely convenience UI.

---

# 75. What This Is Not

Do not turn this into:

```text
general scripting language
database migration system
full backup system
arbitrary workflow engine
user-programmable code execution
```

It is:

> **a versioned declarative specification and patch layer over Paper Lab's canonical application commands.**

---

# 76. Questions for Claude

## Q1 — Architectural role

Do you agree PLPS should become a shared declarative command/specification layer used by:

```text
UI import
future LLM API
automation
testing
portable export
```

rather than a frontend-only import parser?

---

## Q2 — Canonical format

Do you agree canonical human-readable JSON is the right V1 representation?

Would you introduce an optional compressed `PLPS1:` share string now or defer it?

---

## Q3 — Context-sensitive operation

Do you agree the same document should mean:

```text
Objects Import
→ CREATE

Selected Object Import
→ PATCH / VERSION / VARIANT
```

based on the import context rather than an operation embedded in the code?

---

## Q4 — Partial specs

Do you agree:

```text
missing = unchanged/default according to operation
null = explicitly clear when domain permits
```

?

---

## Q5 — READY Entity trait patch

For a selected READY Entity, should an immutable-trait patch:

```text
A. preview CREATE_VARIANT automatically
```

or:

```text
B. be blocked and require the user to explicitly choose Create Variant
```

?

GPT prefers A with explicit confirmation in the ImportPlan.

---

## Q6 — Entity finalization

Do you agree import should never automatically transition:

```text
DRAFT → READY
```

in V1?

---

## Q7 — Arena patch

Do you agree:

```text
unused Arena version
→ patch

used immutable Arena
→ CREATE_VERSION
```

using the same portable Arena spec?

---

## Q8 — Nested patch

Do you agree known object fields should recursively merge while arrays replace by default?

---

## Q9 — Protected fields

Do you agree identity/provenance/generated fields should be rejected rather than ignored?

---

## Q10 — Unknown fields

Do you agree unknown fields should fail validation instead of being ignored, specifically to make LLM-generated import codes safe?

---

## Q11 — Bundle aliases

Do you agree portable bundles should reference newly-created objects by local aliases instead of database IDs?

---

## Q12 — Bundle atomicity

Do you agree bundle application should be all-or-nothing by default?

How should we handle Arena market-data snapshot preparation relative to that atomic boundary?

---

## Q13 — Existing-object references

Should V1 support references to arbitrary already-existing objects inside bundles, or defer this and rely on:

```text
selected-context patch
+
bundle-local aliases
```

?

GPT recommends defer.

---

## Q14 — Preview/apply

Do you agree every import should resolve to an explicit server-side ImportPlan before mutation, and Apply should execute that exact plan?

---

## Q15 — Stale-plan protection

Do you agree target/version fingerprints should invalidate a plan if state changes between Preview and Apply?

---

## Q16 — Export

Should portable Export Code ship in the same milestone as Import, even if basic?

GPT leans yes because import and export should share the same schema from the beginning.

---

## Q17 — Audit

Should we add a summary:

```text
IMPORT_APPLIED
```

AuditEvent in addition to normal domain-specific events, or is that redundant?

---

## Q18 — Schema discovery

Do you agree the backend should eventually expose machine-readable import schemas for LLM/API consumers?

Should this ship in V1?

---

## Q19 — PLPS compatibility

Portable codes may live longer than internal development archives.

Should PLPS v1 receive a stronger backwards-compatibility promise than ordinary project-version storage?

---

## Q20 — General Setup Import UI

Where should bundle import live?

Options:

```text
A. global header utility
B. dedicated top-level Setup/Import page
C. object-panel Import recognizes bundle and opens full preview
D. Console
```

GPT currently favors C initially to avoid another top-level page.

---

## Q21 — File import

Should V1 support both:

```text
paste code
load JSON file
```

or paste only?

---

## Q22 — Milestone ordering

Do you agree this infrastructure is valuable enough to build **before Evolution / Market Memory** so every future subsystem is portable and LLM-addressable from its first implementation?

GPT recommends yes.

---

# 77. Requested Claude Role

Please review this as a **major architecture feature**, not UI polish.

Challenge specifically:

```text
immutability boundaries
partial patch semantics
READY Entity variants
Arena versioning
bundle atomicity
market-data side effects
portable references
LLM safety
API reuse
schema compatibility
audit behavior
```

Do not optimize for preserving GPT's exact syntax.

The objective is a simple, durable specification layer that future subsystems can adopt without rewriting the import architecture.

---

# 78. Requested Response

Please respond:

```text
ACCEPT
ACCEPT WITH REFINEMENTS
DISAGREE
```

Classify findings:

```text
BLOCKER
HIGH
MEDIUM
LOW
SUGGESTION
```

Please answer Q1–Q22 explicitly.

If substantial disagreements remain, continue the peer-design round before implementation.

No implementation should begin until the portable-import architecture is closed.
