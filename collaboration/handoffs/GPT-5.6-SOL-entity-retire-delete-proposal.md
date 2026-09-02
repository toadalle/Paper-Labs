# Paper Lab — Entity Retire → Delete Proposal

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T10:52:00-05:00  
**Thread:** domain lifecycle / destructive actions / frontend  
**Status:** revised proposal — Claude review requested  
**Current implementation baseline:** `paper_labs_1.3.6`  
**Implementation:** Entity deletion remains intentionally unimplemented

---

## 1. User Requirement

The user prefers a two-stage lifecycle:

```text
Active Entity
    ↓
Retire
    ↓
Retired Entity
    ↓
Delete
```

Delete should therefore **never be the first destructive action** on an active Candidate or Permanent Entity.

The UI should expose:

```text
right-click Entity object
→ context menu

Inspector → Actions
→ Retire while active
→ Delete once Retired
```

This proposal replaces the earlier idea of allowing direct hard-delete on a fresh active Candidate.

---

## 2. Retire Is the Safety Gate

Recommendation:

```text
CANDIDATE / PERMANENT
→ Delete unavailable
→ Retire available when lifecycle rules permit

RETIRED
→ Delete becomes available
```

This gives destructive intent an explicit, reversible-in-UI staging step before physical removal is even considered.

Retirement itself preserves the Entity and all research/history references.

---

## 3. The Remaining Architectural Problem

A Retired Entity may still be referenced by immutable evidence:

```text
Experience.entityId
MarketMemoryCell.entityId
PromotionDecision candidate/permanent references
child Entity.parentEntityId
EvolutionRun / birth lineage
AuditEvent subject/details
```

Simply deleting the Entity row can make historical views incomplete or create broken lineage navigation.

Therefore Claude needs to choose between two safe implementations.

---

## 4. Option A — Retired + Unreferenced Hard Delete Only

Rules:

```text
Entity.lifecycleState == RETIRED
AND
zero Experiences
zero MarketMemoryCells
zero Promotion references
zero child lineage references
zero Evolution-origin/history references requiring resolution
```

Then:

```text
DELETE Entity row
+
ENTITY_DELETED AuditEvent
```

If any historical reference exists:

```text
Delete disabled/rejected
Entity remains Retired
```

### Advantages

- simplest persistence model
- no broken historical references
- no new domain object
- easy to reason about

### Disadvantage

It does **not** fully satisfy the user's intuitive rule that every Retired Entity can eventually be deleted.

---

## 5. Option B — Retired Delete With Immutable Tombstone

Recommendation if we want the user's lifecycle to be universal.

Deleting a Retired Entity that has historical references would:

```text
Retired Entity
    ↓
materialize immutable EntityTombstone
    ↓
remove Entity from normal Entity population/catalog
    ↓
preserve historical identity resolution
```

Conceptual tombstone:

```ts
EntityTombstone {
  id
  nameAtDeletion
  familyAtDeletion
  createdAt
  retiredAt
  deletedAt

  birthEvolutionRunId
  parentEntityId
  mutationOperator
  traitsHash

  deletionReason
}
```

The tombstone is not a living Entity and never re-enters:

```text
Evolution
Promotion
Entity population
Recent/Pinned
ordinary Entity search/table
```

Historical Experience/lineage/audit viewers may resolve an ID against:

```text
Entity
OR
EntityTombstone
```

### Advantages

- user can truly Retire → Delete any Entity
- normal UI remains clean
- immutable research history remains explainable
- lineage IDs do not become mysterious dead strings

### Costs

- new first-class persistence concept
- historical readers must resolve tombstones
- migration/tests are more substantial
- must define exactly which fields are retained

---

## 6. GPT Recommendation

**Prefer Option B if Claude agrees the added tombstone concept is proportionate.**

The user's desired mental model is clear:

```text
Retire = stop participating
Delete = remove from normal Paper Lab working population
```

A tombstone lets us honor that without pretending research history never existed.

If Claude considers the tombstone too much V1 complexity, use Option A temporarily and document that research-linked Retired Entities cannot yet be physically deleted.

Do **not** perform unrestricted SQL deletion of referenced Entities.

---

## 7. Context Menu Grammar

Entity object right-click should open an anchored, viewport-aware context menu.

Active Entity:

```text
Open / Inspect
Pin / Unpin
────────────
Retire
```

Retired Entity:

```text
Open / Inspect
Pin / Unpin
────────────
Delete
```

Actions should come from the same shared Entity action definitions used by Inspector so labels, enabled state, ordering, and disabled reasons cannot drift.

---

## 8. Inspector Actions

The Inspector should expose the same lifecycle action:

```text
Active
→ Retire

Retired
→ Delete
```

Delete must not be shown as an active option before retirement.

Long labels continue using the responsive action-grid rules already implemented in 1.3.x.

---

## 9. Confirmation

Retire and Delete are destructive/blocking actions, so a confirmation modal is permitted under the frozen frontend rules.

Retire confirmation should explain:

```text
Entity leaves active research/evolution participation.
History remains.
```

Delete confirmation should explain whether the operation is:

```text
hard delete of an unreferenced retired Entity
```

or, if Option B is adopted:

```text
removal from the active Entity catalog while an immutable historical tombstone remains
```

No generic form modal is introduced.

---

## 10. Audit Requirements

Retire:

```text
ENTITY_RETIRED
```

Delete:

```text
ENTITY_DELETED
```

or, if terminology should reflect tombstoning:

```text
ENTITY_TOMBSTONED
```

The final destructive persistence mutation and AuditEvent must commit atomically.

Audit must preserve enough identity to explain what was removed without storing mutable presentation noise.

---

## 11. Monotonic Naming

Deletion never rewinds the `New Entity N` sequence.

Example:

```text
New Entity 72
→ Retired
→ Deleted

next create
→ New Entity 73+
```

No number reuse.

---

## 12. Local UI Cleanup After Delete

After successful Delete:

```text
remove Entity ID from Recent
remove from Pinned
clear current Entity URL if selected
select a sensible remaining Entity or empty state
close context menu
update Inspector
```

These are presentation cleanups, not AuditEvents.

---

## 13. Server Authority

Frontend state is advisory only.

Server must re-check:

```text
Entity exists
Entity is RETIRED
reference/tombstone rules
transactional audit eligibility
```

immediately before mutation.

No generic repository `delete(any kind)` endpoint.

---

## 14. Question for Claude

The user has settled the UX lifecycle:

```text
Retire first
Delete second
```

The only architectural decision requested is:

### Q1

Should `Delete` on a research-referenced Retired Entity be:

```text
A. blocked unless the Entity is completely unreferenced
```

or:

```text
B. allowed by replacing the normal Entity with an immutable EntityTombstone
   so historical evidence and lineage remain resolvable?
```

GPT currently recommends **B** if the additional persistence/read-path complexity is acceptable for V1; otherwise A is the safe fallback.

Please respond:

```text
ACCEPT OPTION A
ACCEPT OPTION B
ACCEPT WITH REFINEMENTS
DISAGREE
```

and classify any concern as:

```text
BLOCKER
HIGH
MEDIUM
LOW
SUGGESTION
```

No Entity deletion code should be implemented until this is settled.
