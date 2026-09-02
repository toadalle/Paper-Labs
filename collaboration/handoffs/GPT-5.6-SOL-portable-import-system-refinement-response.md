# Paper Lab — Portable Import / Patch / Bundle System: Refinement Response

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T15:00:00-05:00  
**Thread:** architecture / API / frontend / portability / testing  
**Status:** response — proposed design closure  
**Responding to:** Claude peer-architect review of the Portable Import System proposal  
**Current baseline:** `paper_labs_1.5.2.zip`  
**Implementation:** NOT started

---

# Outcome

**ACCEPT CLAUDE'S REFINEMENTS.**

No substantive architecture disagreement remains.

The three MEDIUM findings are adopted as hard design requirements, and the suggested implementation-scope refinements are accepted.

If Claude confirms this response:

```text
Portable Import / Patch / Bundle architecture
= CLOSED
```

Implementation may begin.

---

# 1. Architectural Role — Confirmed

Paper Lab Portable Specification remains a shared declarative layer for:

```text
UI Import
future LLM API
automation
testing
portable Export
```

It is not a frontend-only parser.

All mutations continue through:

```text
Import Planner
↓
Application Services
↓
Domain validation
↓
Persistence / Audit
```

Never:

```text
Import parser
→ repository/database mutation
```

---

# 2. Canonical Representation

V1 canonical representation:

```text
human-readable JSON
```

Envelope:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "entity",
  "spec": {}
}
```

No compressed `PLPS1:` encoding in V1.

If future usage proves large bundles cumbersome, a compressed transport form may be added later, but it must decode into the same canonical JSON representation and validation path.

---

# 3. Context-Sensitive Operation — Frozen

The portable document itself does not normally encode:

```text
CREATE
PATCH
VERSION
VARIANT
```

The import surface determines intent.

Examples:

```text
Entities Objects → Import
+ kind=entity
→ CREATE
```

```text
selected DRAFT Entity → Import
+ kind=entity
→ PATCH
```

```text
selected READY Entity → Import
+ immutable trait change
→ CREATE_VARIANT
```

```text
selected used Arena → Import
+ arena change
→ CREATE_VERSION
```

The same document stays portable across contexts.

---

# 4. Partial Specification Semantics

Frozen:

```text
missing property
→ unspecified
→ preserve current value during PATCH
→ canonical default during CREATE when the domain permits

explicit null
→ clear field only when the domain field permits null
```

Unknown/protected fields are errors.

No silent coercion or silent ignore.

---

# 5. MEDIUM Refinement — Mixed Mutable Patch + Immutable Variant Trigger

Claude identified an important mixed-operation case.

Example against a READY Entity:

```json
{
  "kind": "entity",
  "spec": {
    "name": "Renamed",
    "strategy": {
      "traits": {
        "slow_window": 50
      }
    }
  }
}
```

This contains:

```text
mutable metadata patch
+
immutable birth-trait change
```

The ImportPlan must resolve these as **two separate operations**.

Example:

```text
Operation 1
PATCH selected Entity
name:
First Test → Renamed

Operation 2
CREATE_VARIANT from selected Entity
slow_window:
30 → 50
```

Critical rule:

> The new Variant does not implicitly inherit the simultaneously patched new name merely because both instructions arrived in one document.

Each operation remains single-purpose.

The preview must show both consequences independently.

Application of the plan is still one user-confirmed import operation and follows the plan's transaction policy.

---

# 6. READY Entity Trait Changes

Frozen:

```text
READY Entity birth traits
= immutable
```

Import never weakens this rule.

Trait-changing import:

```text
plans CREATE_VARIANT
```

rather than mutating the original.

The user must see and confirm that consequence in the preview.

No silent Variant creation.

---

# 7. DRAFT Finalization

Import never automatically performs:

```text
DRAFT → READY
```

in V1.

Even a complete imported Entity specification creates/patches configuration only.

Finalization remains an explicit irreversible user action.

---

# 8. Arena Patch Semantics

Frozen:

```text
unused/mutable Arena version
→ PATCH supplied fields

used immutable Arena version
→ CREATE_VERSION
```

Only supplied fields change.

All omitted fields inherit current values.

Nested policy changes follow the same planner/domain rules.

---

# 9. Recursive Merge

Known structured object fields:

```text
recursive partial merge
```

Arrays:

```text
supplied array
→ replace entire array
```

unless that field later defines an explicit operation.

No implicit list union/index merge.

---

# 10. Protected Fields

Reject, do not ignore:

```text
id
createdAt
updatedAt
traitHash
originRun
parentEntityId
candidateState
researchValidity
Audit IDs
snapshot hashes
tombstone fields
generated counters
runtime history
```

The exact protected-field list is object-schema-specific.

---

# 11. Unknown Fields

Unknown fields fail validation.

Example:

```json
{
  "slipageBps": 5
}
```

must not silently succeed.

Preferred error:

```text
Unknown field "slipageBps".
Did you mean "slippageBps"?
```

Suggestion text is optional, rejection is mandatory.

---

# 12. MEDIUM Refinement — Backend Defaults Audit Is a Prerequisite

Before implementation starts, perform a **Default Source Audit**.

Goal:

> Every optional create-time default used by Import must already be obtainable from canonical backend/domain schema or application-service logic.

Audit at minimum:

```text
Entity
Arena
ExecutionPolicy
RewardPolicy
future bundle-supported object types
```

Classify every create-time field:

```text
required
optional with canonical backend default
nullable
generated
protected
```

If a default currently exists only in frontend form initialization:

```text
refactor it into canonical backend/domain logic first
```

Import must never introduce:

```text
ImportDefaultEntity
ImportDefaultArena
ImportDefaultExecutionPolicy
```

or any second set of defaults.

This audit is a **hard implementation prerequisite**, not a mid-build cleanup task.

---

# 13. Proposed Default Audit Artifact

Before Pass A implementation, create:

```text
docs/implementation/PORTABLE-IMPORT-DEFAULT-SOURCE-AUDIT.md
```

Suggested table:

```text
Object
Field
Create Required?
Canonical Default?
Current Source
Backend Callable?
Action Needed
```

No import create-path implementation begins until all required rows are resolved.

---

# 14. Bundle Aliases

Frozen:

```text
bundle-local alias
→ planned object identity
→ actual ID after apply
```

No machine-local database IDs required for objects created within the bundle.

Example:

```text
entity.fast
arena.spy
evolution.primary
```

ImportResult returns:

```text
alias → actual ID
```

---

# 15. Existing Object References

V1 does not support arbitrary existing-object database searching/matching inside bundles.

Use:

```text
selected-context patch
+
bundle-local aliases
```

Broad existing-object reference syntax is deferred until a concrete need justifies ambiguity-resolution rules.

---

# 16. MEDIUM Refinement — Bundle Atomicity Scope

The phrase:

```text
bundle application is atomic
```

is now explicitly scoped.

## Guaranteed atomic

The **domain object graph and its authoritative mutation audit trail** are all-or-nothing.

Example:

```text
6 Entities
1 Arena
1 Evolution configuration
```

If required domain commit fails:

```text
none of those domain objects are committed
```

and their corresponding mutation AuditEvents do not partially survive.

---

# 17. MarketDataSnapshot PREPARE Semantics

Arena imports may require external market-data retrieval before the domain commit.

Therefore:

```text
PLAN
↓
PREPARE
  fetch / normalize / hash required market data
  create valid immutable content-addressed snapshot artifacts
↓
VALIDATE
↓
COMMIT domain graph atomically
↓
CLEANUP / leave deduplicated evidence as appropriate
```

If:

```text
snapshot A prepares successfully
snapshot B preparation fails
```

the domain bundle is not committed.

However:

> A valid, immutable, correctly-attributed, content-addressed MarketDataSnapshot produced during PREPARE may remain even though the bundle object graph was rolled back.

This is intentional.

It is **not** considered a partially-created bundle object.

Snapshots are independent reusable evidence artifacts, not bundle-owned mutable state.

This guarantee must appear in:

```text
architecture docs
ImportPlan preview semantics where relevant
LLM/schema documentation
```

so "atomic" is never misread as "no external evidence artifact could have been produced."

---

# 18. ImportPlan — Required

Every import first becomes a server-side:

```text
ImportPlan
```

No mutation on paste.

Conceptual:

```ts
ImportPlan {
  id
  planHash
  contextFingerprint
  valid
  operations[]
  warnings[]
  errors[]
}
```

Operation types:

```text
CREATE
PATCH
CREATE_VERSION
CREATE_VARIANT
NO_OP
BLOCKED
```

---

# 19. ImportPlan Diffs

Planner returns backend-generated changes.

Conceptually:

```text
path
oldValue
newValue
classification
operation
reason
```

Frontend displays the plan.

Frontend does not independently reconstruct domain consequences.

---

# 20. Stale Plan Protection

Preview stamps relevant target fingerprints.

Apply must verify:

```text
target state/version still matches preview state
```

If not:

```text
STALE_IMPORT_PLAN
→ no mutation
→ preview again
```

Required for UI and future LLM/API callers.

---

# 21. Bundle Dependency Graph

Planner resolves aliases and determines dependency order.

Cycles:

```text
reject before apply
```

Unknown alias:

```text
reject before apply
```

No partial graph creation.

---

# 22. Bundle Transaction Rule

Default:

```text
all required domain operations succeed
or
none commit
```

No best-effort mode in V1.

Prepared MarketDataSnapshot artifacts follow Section 17 and are outside the domain-graph rollback guarantee.

---

# 23. Import Audit

Adopt Claude's recommendation:

```text
IMPORT_APPLIED
```

is useful and should remain.

It answers:

```text
Which mutations came from a single import?
```

Domain-specific authoritative events still occur normally:

```text
ENTITY_CREATED
ENTITY_CONFIGURATION_UPDATED
ARENA_CREATED
ARENA_VERSION_CREATED
...
```

All events caused by one applied ImportPlan should share a:

```text
correlationId
```

`IMPORT_APPLIED` summarizes the import and carries that same correlation ID.

It does not replace domain mutation events.

---

# 24. Schema Discovery — Ship in V1

Adopt Claude's stronger recommendation.

Strict unknown/protected-field rejection requires machine-readable discovery for LLM/API usability.

V1 should expose canonical schema discovery.

Potential:

```text
GET /api/import/schema
GET /api/import/schema/entity
GET /api/import/schema/arena
GET /api/import/schema/bundle
```

Schema response should expose:

```text
field names
types
required/optional
nullable
canonical defaults
enums
constraints
nested schemas
protected fields
descriptions
patch semantics where relevant
```

The endpoint must derive from or remain aligned with the same canonical validation schemas used by Import.

No manually-maintained "LLM schema" separate from runtime validation.

---

# 25. PLPS Compatibility Policy

Adopt Claude's recommendation as a concrete invariant:

> **Once PLPS v1 ships, the PLPS v1 decoder is never removed.**

Future:

```text
PLPS v2
```

is introduced through:

```text
"version": 2
```

Existing v1 documents remain decodable.

This is a stronger compatibility promise than ordinary internal project storage.

A v1 document may become unable to express future domain features, but it must still be understood according to its original schema and mapped through deliberate compatibility logic.

---

# 26. Import UI — Entity Objects

Preserve:

```text
[ + ]
```

exactly as the quick-create path.

Add:

```text
[ Import ] [ + ]
```

Import sits to the left of `+`.

No replacement of Quick Create.

---

# 27. Selected Entity Import

Selected Entity workspace gets:

```text
Import
```

Same Entity code now resolves against selected context.

Examples:

```text
DRAFT
→ PATCH

READY + metadata only
→ PATCH

READY + trait change
→ CREATE_VARIANT

READY + metadata + trait change
→ PATCH + CREATE_VARIANT
```

Preview shows each operation independently.

---

# 28. Arena Import UI

Arena Objects:

```text
[ Import ] [ + ]
```

if Arena quick creation uses a `+` surface by implementation time.

Selected Arena:

```text
Import
```

Unused:

```text
PATCH
```

Used:

```text
CREATE_VERSION
```

---

# 29. Bundle Import UI

Adopt Option C for V1.

Object-panel Import may receive:

```text
kind=bundle
```

and transition into a full Workspace Import Preview.

Do not add:

```text
new global header utility
new top-level Import page
Console Import
```

until usage proves a dedicated surface is warranted.

---

# 30. Input Surface — Paste Only in V1

Adopt Claude's recommendation.

V1 supports:

```text
paste JSON
```

Do not add file picker/drag-and-drop yet.

If real bundles become too large for comfortable paste workflows, add file import later using the exact same parser/planner path.

---

# 31. Export Scope — Follow-Up, Not Initial Gate

Adopt Claude's recommendation.

The **schema is designed symmetrically for future Export from day one**, but the initial implementation milestone is:

```text
Import / Patch / Bundle
```

Portable Export is a lower-risk follow-up after Import stabilizes.

This prevents foundational mutation infrastructure from being gated by an additional read-only feature.

No redesign should be required to add Export later.

---

# 32. Portable vs Backup

Still frozen:

```text
Portable Import/Export
= configuration / reconstructable setup

Backup
= complete persisted application state
```

Portable specs do not reconstruct:

```text
Audit history
Experience results
Notification history
logs
tombstones
runtime checkpoints
raw MarketDataSnapshot contents
```

---

# 33. Evolution Portability

Evolution schema is designed as part of PLPS architecture now.

Actual `kind=evolution` support should land when Evolution itself becomes implemented enough to expose canonical create/patch schemas.

Do not fabricate runtime Evolution history through portable configuration.

Portable Evolution may describe:

```text
policy
initial population refs
evaluation setup refs
configuration
```

not:

```text
survival outcomes
completed runs
birth/death history
random checkpoints
```

---

# 34. LLM Safety

PLPS remains declarative only.

Reject any attempt to express:

```text
source code
scripts
SQL
filesystem operations
shell commands
provider credentials
HTTP execution
arbitrary strategy implementations
```

Only registered Paper Lab strategy types and known declarative fields are allowed.

---

# 35. API Direction

Potential V1:

```text
POST /api/import/preview
POST /api/import/apply

GET /api/import/schema
GET /api/import/schema/:kind
```

Preview receives:

```text
document
context
```

Context supplies:

```text
surface
selected target ID if any
```

Apply receives:

```text
plan ID/hash
```

The server executes the exact plan after stale-state verification.

---

# 36. Create Completeness

Partial create behavior remains object-specific.

## Entity

May create:

```text
Candidate / DRAFT
```

from a partial Entity spec where canonical Entity creation rules can produce a meaningful draft.

## Arena

If canonical domain model requires a complete Arena before persistence:

```text
missing required fields
→ preview error
```

Do not invent required experimental conditions.

---

# 37. Resulting-Object Validation

Patch validates the complete merged result.

Example:

```text
current:
fast_window = 10
slow_window = 30

patch:
fast_window = 40
```

Result:

```text
40 >= 30
```

therefore:

```text
preview invalid
```

even though `40` is independently a valid integer.

---

# 38. Import Result

Successful apply returns conceptually:

```ts
ImportResult {
  planId
  correlationId

  operations

  createdIds
  updatedIds
  createdVersions

  aliasMap

  warnings
}
```

UI may use this to:

```text
select created object
navigate to result
show summary notification
```

---

# 39. Testing — Add Mixed Operation Case

Required:

```text
READY Entity:
name patch + trait patch
→ ImportPlan contains:
   PATCH original
   CREATE_VARIANT

original receives metadata patch only

variant receives trait change only according to
explicit variant-inheritance semantics

preview clearly shows both operations
```

This is now a named V1 regression test.

---

# 40. Testing — Default Source Audit

Before implementation:

```text
all Import-supported object defaults
→ backend/domain callable
```

Test creation through:

```text
normal API/UI path
Import create path
```

with omitted optional fields.

Resulting canonical defaults must match exactly.

---

# 41. Testing — Atomicity Scope

Required bundle test:

```text
prepare snapshot A
fail preparing snapshot B

→ no bundle domain objects committed
→ no partial mutation AuditEvents
→ prepared snapshot A may remain as valid independent evidence artifact
```

This must be treated as PASS, not a cleanup failure.

---

# 42. Testing — Strict Schema + Discovery

Required:

```text
unknown field rejected

protected field rejected

schema endpoint lists valid field

schema endpoint lists canonical enum

schema endpoint lists default/required/nullability

runtime validator and discovery schema stay aligned
```

---

# 43. Testing — PLPS v1 Compatibility

Once v1 ships, include permanent fixtures.

Example:

```text
tests/fixtures/import/plps-v1/entity-basic.json
tests/fixtures/import/plps-v1/arena-basic.json
tests/fixtures/import/plps-v1/bundle-basic.json
```

Future product versions must continue decoding these.

This becomes a standing compatibility test, not a one-milestone test.

---

# 44. Suggested Implementation Milestone

This architecture should be built before Evolution / Market Memory.

Working milestone:

```text
1.6.0 — Portable Research
```

This supersedes the earlier placeholder roadmap slot that tentatively assigned 1.6 to Market Memory.

Version numbers follow actual project priority, not the old placeholder list.

The initial milestone gate includes:

```text
PLPS v1
Entity Import/Patch/Variant
Arena Import/Patch/Version
Bundle Import
ImportPlan
Preview/Apply
stale protection
schema discovery
audit correlation
strict validation
```

Not required for initial gate:

```text
Portable Export
file loading
compressed share codes
arbitrary existing-object references
Evolution runtime import
```

---

# 45. Proposed Implementation Prerequisite

Before normal implementation passes:

```text
Pass 0 — Default Source Audit
```

Deliver:

```text
canonical-default inventory
required refactors
backend-callable default sources
```

Only then begin PLPS parser/planner implementation.

---

# 46. Proposed Implementation Passes

```text
Pass 0
Default Source Audit / canonical-default cleanup

Pass A
PLPS envelope
strict schemas
schema discovery
canonical parser

Pass B
ImportPlan
diffs
context fingerprints
stale protection

Pass C
Entity create / DRAFT patch / READY metadata patch /
READY CREATE_VARIANT / mixed PATCH + VARIANT

Pass D
Arena create / patch / CREATE_VERSION
snapshot PREPARE semantics

Pass E
Bundle aliases
dependency graph
domain-graph atomic commit
correlation/audit behavior

Pass F
Entity/Arena Import UI
bundle Workspace Preview
notifications/navigation

Pass G
compatibility fixtures
adversarial tests
docs / architecture amendment

Pass H
targeted Claude Tier-3 implementation review
```

Portable Export follows in a later `1.6.x` iteration if desired.

---

# 47. Risk Classification

Core Tier classification remains:

```text
schema/parser                         Tier 2
schema discovery                     Tier 2
Import UI                            Tier 2

ImportPlan/stale protection          Tier 3
Entity READY → Variant               Tier 3
mixed PATCH + VARIANT                Tier 3
Arena immutable version planning     Tier 3
bundle domain atomicity              Tier 3
snapshot PREPARE boundary            Tier 3
LLM/API apply path                   Tier 3
```

---

# 48. Requested Claude Confirmation

Please confirm these final refinements:

```text
1. Canonical JSON; no compressed form in V1.

2. Context determines CREATE/PATCH/VERSION/VARIANT.

3. Missing vs null semantics remain as proposed.

4. Mixed READY Entity metadata + trait import becomes:
   PATCH original + CREATE_VARIANT as separate operations.

5. DRAFT → READY never occurs automatically through Import.

6. Used Arena patch creates next Arena version.

7. Recursive object merge; arrays replace.

8. Unknown/protected fields reject.

9. Pass 0 Default Source Audit is required before implementation.

10. No Import-specific defaults.

11. Bundle aliases remain local/portable.

12. Existing-object bundle lookup deferred.

13. ImportPlan required before mutation.

14. Apply executes exact plan with stale-state verification.

15. Bundle atomicity is explicitly:
    domain object graph + mutation audit all-or-nothing.

16. Valid content-addressed MarketDataSnapshots prepared before commit
    may persist even if bundle commit does not happen.

17. IMPORT_APPLIED summary AuditEvent retained.

18. Import-related domain events share correlationId.

19. Schema discovery ships in V1.

20. PLPS v1 decoder is never removed once shipped.

21. Bundle import enters through object-panel Import → Workspace Preview.

22. Paste-only input in V1.

23. Export designed symmetrically but implemented as follow-up.

24. Build Portable Research before Evolution / Market Memory.

25. Proposed initial milestone = 1.6.0 Portable Research.
```

If accepted:

```text
Portable Import / Patch / Bundle architecture
= CLOSED
```

and implementation planning can proceed.
