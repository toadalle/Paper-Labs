# Architecture Amendment 005 — Portable Research Specifications

**Status:** accepted / implemented in Paper Lab 1.6.0  
**Scope:** PLPS v1 import, patch, variant/version planning, bundles, schema discovery

## 1. Purpose

Paper Lab Portable Specification (PLPS) is the shared declarative configuration layer used by UI Import and intended for future LLM/API automation, testing, and portable Export. PLPS never mutates repositories directly; it resolves into Application Service commands and remains subordinate to all domain immutability, validation, audit, and provenance rules.

Canonical envelope:

```json
{
  "format": "paper-lab",
  "version": 1,
  "kind": "entity",
  "spec": {}
}
```

PLPS v1 canonical transport is human-readable JSON. The v1 decoder is a permanent compatibility surface once shipped.

## 2. Context Determines Operation

The document is portable configuration intent; the import surface supplies target semantics.

```text
Entity Objects Import  -> CREATE
Selected DRAFT Entity  -> PATCH
Selected READY Entity immutable change -> CREATE_VARIANT
Arena Objects Import   -> CREATE
Selected unused Arena  -> PATCH
Selected used Arena    -> CREATE_VERSION
Bundle Objects Import  -> atomic domain-graph create plan
```

CREATE/PATCH/VERSION/VARIANT are not normally embedded in the portable document.

## 3. Partial Specification Rules

- Missing property: unspecified. Preserve current value on PATCH; use canonical backend create default when the object permits one.
- Explicit `null`: clear only when the domain field is nullable.
- Known nested objects merge recursively.
- Supplied arrays replace the entire array in V1.
- Unknown fields fail validation.
- Protected/generated identity, provenance, lifecycle, and historical fields fail validation rather than being ignored.

The complete merged result is domain-validated. Individually valid scalar values do not make an invalid cross-field result acceptable.

## 4. Entity Rules

Entity CREATE always produces `CANDIDATE / DRAFT`; Import never performs DRAFT -> READY.

A CREATE document may omit strategy entirely. If it supplies strategy configuration, strategy `type` and `version` are required explicitly. Trait defaults come from that registered immutable strategy version. Traits without strategy identity are rejected on CREATE.

A selected DRAFT Entity may inherit its existing strategy identity for partial trait patches.

READY strategy type/version/traits remain birth-immutable. A trait-changing import plans `CREATE_VARIANT` instead of rewriting the selected Entity. The Variant is a new DRAFT Entity with lineage back to the READY parent.

When one READY import mixes mutable metadata and immutable birth changes, the plan contains two independent operations:

```text
PATCH original mutable metadata
CREATE_VARIANT for immutable strategy change
```

Variant inheritance is evaluated from the pre-import parent state; a simultaneous metadata patch does not leak into Variant inheritance merely because both instructions arrived in one document.

## 5. Arena Rules

Arena CREATE uses canonical backend defaults from `src/domain/create-defaults.ts`; PLPS defines no parallel defaults.

Selected unused Arena versions may be patched in place. Selected used/locked Arena versions are never overwritten; the planner emits `CREATE_VERSION`, inheriting omitted values and changing only supplied configuration.

Snapshot provider/feed are environment-resolved, not portable Arena fields in PLPS v1. Preview discloses the environment resolution. Policy-only or metadata-only version changes may reuse the existing valid snapshot when the market-data capture identity is unchanged.

## 6. ImportPlan

Pasting code does not mutate state. Server-side preview produces an `ImportPlan` containing normalized operations, diffs, consequences, warnings/errors, a plan hash, expiry, and fingerprints of selected targets.

Apply executes that exact plan. If target state has changed after preview, Apply fails with `STALE_IMPORT_PLAN` and requires a new preview.

A plan is single-use.

## 7. Bundle Semantics

PLPS v1 bundles create Entity and Arena objects and use bundle-local aliases instead of machine-local database IDs. Arbitrary lookup/mass-patching of pre-existing objects by name is deferred.

Bundle domain-object mutation is all-or-nothing. Required domain mutation AuditEvents are part of the same transaction.

Arena snapshot capture is a PREPARE side effect before the domain commit:

```text
PLAN -> PREPARE snapshots -> VALIDATE -> COMMIT domain graph
```

A correctly attributed immutable content-addressed MarketDataSnapshot prepared before a later failure may persist even if the bundle's domain graph is not committed. That snapshot is independent evidence, not a partially-created bundle object. This is expected behavior.

## 8. Audit Correlation

Normal domain mutation AuditEvents remain authoritative. A successful import also appends `IMPORT_APPLIED`. All mutations caused by one Apply share the request/import correlation ID so the summary and domain events can be queried together.

## 9. Schema Discovery

V1 exposes machine-readable discovery:

```text
GET /api/import/schema
GET /api/import/schema/entity
GET /api/import/schema/arena
GET /api/import/schema/bundle
```

Discovery exposes canonical fields, required/default/nullability information, enums/constraints, strategy trait schemas, protected fields, and the Arena environment provider/feed resolution. Discovery must stay aligned with runtime validation and canonical backend defaults.

## 10. Safety Boundary

PLPS is declarative data only. It cannot contain or execute source code, shell commands, SQL, filesystem actions, credentials, URLs-as-actions, or arbitrary strategy implementations. Only registered Paper Lab strategy types and recognized fields are legal.

## 11. V1 Scope

Implemented:

- Entity create / DRAFT patch / READY metadata patch / READY Variant planning
- Arena create / unused patch / used-version creation
- mixed PATCH + CREATE_VARIANT
- bundle aliases and domain-graph atomicity
- preview/apply and stale-plan protection
- strict schemas and schema discovery
- paste-only UI surfaces
- permanent PLPS v1 compatibility fixtures

Deferred without redesign:

- Portable Export
- file loading / drag-drop
- compressed share strings
- arbitrary existing-object bundle selectors
- Evolution portable runtime configuration until Evolution exists
