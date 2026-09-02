# Paper Lab — Milestone 1.6.0: Portable Research

## Goal

1.6.0 makes Paper Lab research configuration portable and LLM-addressable without weakening domain invariants. The same PLPS v1 JSON code can create an object from an Objects-panel Import surface or patch/version/variant a selected object according to context.

## Pass 0

The required Default Source Audit is complete at:

`docs/implementation/PORTABLE-IMPORT-DEFAULT-SOURCE-AUDIT.md`

Arena create defaults were centralized in `src/domain/create-defaults.ts`. Entity strategy-trait defaults remain owned by registered strategy definitions. Import has no separate defaults.

## Backend

New modules:

- `src/application/import/types.ts`
- `src/application/import/parser.ts`
- `src/application/import/import-service.ts`

New API:

- `GET /api/import/schema`
- `GET /api/import/schema/:kind`
- `POST /api/import/preview`
- `POST /api/import/apply`

Every mutation is previewed as a server-side ImportPlan first. Plans are hashed, expire after 30 minutes, are single-use, and fingerprint selected targets for stale-state detection.

## Entity semantics

- Objects Import -> new `CANDIDATE / DRAFT`
- selected DRAFT -> recursive partial PATCH
- selected READY metadata -> PATCH original
- selected READY birth change -> CREATE_VARIANT
- mixed metadata + trait change -> PATCH original + CREATE_VARIANT
- Import never finalizes DRAFT -> READY
- protected/generated fields rejected
- unknown strategy traits rejected

A new Variant uses pre-import parent lineage/metadata state and receives a normal monotonic `New Entity N` identity.

## Arena semantics

- Objects Import -> CREATE
- selected unused Arena -> PATCH same Arena ID/version
- selected used Arena -> CREATE_VERSION
- omitted values inherit current values on selected patch
- canonical backend defaults apply on CREATE
- provider/feed remain environment-resolved and are shown in preview consequences
- unchanged market-data identity can reuse the existing valid snapshot rather than needlessly fetching it again

## Bundles

V1 bundles support Entity and Arena create objects with portable aliases. Domain-object graph commit is all-or-nothing. Snapshot preparation occurs before domain commit; valid prepared snapshot evidence may remain after a later preparation/commit failure by design.

## Audit

Successful Apply adds `IMPORT_APPLIED` while preserving normal domain events (`ENTITY_CREATED`, `ENTITY_METADATA_UPDATED`, `ENTITY_VARIANT_CREATED`, `ARENA_CREATED`, `ARENA_UPDATED`, `ARENA_VERSION_CREATED`, etc.). One correlation ID links the complete import.

## Frontend

Entities Objects keeps the existing fast `+` action and adds `Import` immediately beside it. Selected Entity has `Import Code`. Arenas Objects and selected Arena expose the same portable Import entry points.

Import is a responsive non-modal side panel:

```text
Paste JSON -> Preview -> inspect operations/diffs/consequences -> Apply Plan
```

Pasting alone never mutates application state.

## Compatibility

PLPS v1 fixtures live under `tests/fixtures/import/plps-v1/`. These become permanent compatibility tests: future product versions must continue decoding PLPS v1 documents.

## Validation target

The milestone specifically tests:

- unknown/protected-field rejection
- canonical schema defaults
- partial Entity create/patch
- READY mixed PATCH + CREATE_VARIANT
- stale-plan rejection
- unused Arena PATCH
- used Arena CREATE_VERSION
- bundle alias mapping
- bundle domain atomicity with surviving prepared snapshot evidence
- UI Import entry points and preview/apply boundary
