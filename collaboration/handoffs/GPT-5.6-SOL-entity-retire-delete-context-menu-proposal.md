# Paper Lab — Entity Retire → Delete + Context Menu Proposal

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T12:03:00-05:00  
**Thread:** domain / frontend / persistence / workflow  
**Status:** proposal — Claude peer/manager review requested  
**Current project baseline:** `paper_labs_1.3.9.zip`  
**Implementation:** NOT started

---

# 1. User Intent

The user wants a clear two-stage Entity lifecycle:

```text
working Entity
→ Retire
→ Delete
```

The UI should expose these actions consistently in:

```text
Entity right-click context menu
+
Entity Inspector → Actions
```

The user explicitly likes retirement as the first step and wants deletion to become available only after retirement.

This proposal therefore does **not** propose direct deletion of active Candidates or Permanent Entities.

---

# 2. Proposed User-Facing Rule

## Candidate / Permanent

Available destructive lifecycle action:

```text
Retire
```

Unavailable:

```text
Delete
```

## Retired

Available:

```text
Delete
```

This gives the user an intentional two-step destructive flow:

```text
Entity
→ Retire
→ review it as Retired
→ Delete when truly unwanted
```

---

# 3. Why Retire Must Come First

Retirement is a domain lifecycle transition.

Deletion is application/persistence removal.

Keeping them separate prevents accidental destruction from a single misplaced click and preserves the meaning already assigned to:

```text
CANDIDATE
PERMANENT
RETIRED
```

A user who merely wants an Entity out of active research should Retire it.

A user who no longer wants the retired Entity in the working application may then Delete it.

---

# 4. Core Historical Problem

Entities can be referenced by immutable or research-relevant records:

```text
Experience
ExperienceEvent
MarketMemoryCell evidence
PromotionDecision
Evolution lineage
offspring/parent relationships
EvolutionRun history
AuditEvent
possibly future Benchmark evidence
```

Physically deleting every trace of an Entity would create broken references and undermine Paper Lab's reproducibility guarantee.

Therefore:

> **Delete must mean removal from the working Entity population, not erasure of historical evidence.**

---

# 5. Recommended Architecture — Entity Tombstone

GPT recommends introducing an immutable:

```ts
EntityTombstone
```

for retired Entities that have historical references.

Conceptually:

```ts
EntityTombstone {
  entityId
  deletedAt

  lastKnownName
  family

  lifecycleAtDeletion: 'RETIRED'

  birthEvolutionRunId?
  parentEntityId?
  lineageOperator?

  originalCreatedAt

  deletionAuditEventId
}
```

Exact fields are open to Claude review.

The tombstone should contain only what is required to resolve historical identity and lineage references.

It must **not** become a second full Entity record.

---

# 6. Delete Semantics

When a Retired Entity is deleted:

```text
Retired Entity
        ↓
determine historical references
```

## No historical references

Paper Lab may physically remove the Entity record.

Audit still records:

```text
ENTITY_DELETED
```

## Historical references exist

Paper Lab performs:

```text
create immutable EntityTombstone
        +
remove working Entity record
        +
preserve immutable research/history records
        +
record ENTITY_DELETED AuditEvent
```

All in one transaction.

This gives the user the same visible result:

```text
Entity disappears from working application
```

while historical evidence remains resolvable.

---

# 7. What Delete Must NOT Do

Delete must never cascade-delete:

```text
Experiences
ExperienceEvents
PromotionDecisions
AuditEvents
Evolution history
MarketDataSnapshots
research-valid historical evidence
```

Historical records remain immutable.

Deletion also must not:

```text
renumber New Entity N
reuse deleted Entity IDs
rewrite lineage
rewrite historical names inside immutable evidence
```

---

# 8. Working Population After Delete

Deleted Entities must disappear from:

```text
Entities table
Recent
Pinned
search
normal lifecycle filters
ordinary object lists
```

They should not appear as a fourth normal lifecycle state.

The working lifecycle remains:

```text
Candidate
Permanent
Retired
```

Deleted is absence from the working population.

---

# 9. Historical Rendering

If historical evidence references a deleted Entity:

```text
Experience
PromotionDecision
Evolution lineage
Audit record
```

the UI should resolve the identifier through:

```text
working Entity
OR
EntityTombstone
```

Example:

```text
New Entity 17
Deleted
entity_abc123...
```

This preserves explainability without restoring the Entity to active application state.

---

# 10. Right-Click Context Menu

Right-clicking an Entity object should open an anchored context menu.

Also support:

```text
Shift+F10
Context Menu key
```

where available.

The menu should use the same shared flyout/context-menu infrastructure as other secondary surfaces.

No modal for the menu itself.

---

# 11. Context Menu — Candidate / Permanent

Conceptual:

```text
Open / Select
Pin / Unpin
────────────
Retire
```

Potential additional ordinary actions may be added only if they already exist elsewhere.

Do not invent a large menu merely because context-menu infrastructure exists.

---

# 12. Context Menu — Retired

Conceptual:

```text
Open / Select
Pin / Unpin
────────────
Delete
```

If restoration from Retired is ever introduced later, that would require its own domain decision and is out of scope.

---

# 13. Inspector Actions

Inspector and context menu must use the **same action definitions**, not duplicated logic.

Candidate/Permanent:

```text
Evaluate
Compare
Promotion (when applicable)
Retire
```

Retired:

```text
Delete
```

plus any read-only/non-lifecycle actions that remain meaningful.

Delete should not appear as enabled before retirement.

---

# 14. Shared Action Definition

Conceptually:

```ts
EntityAction {
  id
  label
  destructive
  visible(entity, context)
  enabled(entity, context)
  disabledReason?
  execute(entity)
}
```

Both:

```text
Inspector
Context Menu
```

render from this same action model.

This prevents action availability from drifting between surfaces.

---

# 15. Retire Confirmation

Retire changes lifecycle but preserves the Entity.

Because it is a meaningful domain transition, retain a destructive confirmation.

Example:

```text
Retire New Entity 17?

This removes it from active research use.
Historical evidence is preserved.
```

This is an appropriate modal because retirement is destructive/blocking in intent.

---

# 16. Delete Confirmation

Delete receives a stronger confirmation.

Example:

```text
Delete New Entity 17?

This removes the retired Entity from the working population.

Historical research and audit records will remain available
through preserved historical identity data.

This action cannot be undone.
```

Buttons:

```text
Cancel
Delete Entity
```

No text-entry confirmation unless real use demonstrates accidental deletions remain a problem.

---

# 17. Backend Eligibility

A Delete endpoint must independently enforce:

```text
Entity exists
AND
Entity.lifecycle_state == RETIRED
```

Frontend state is not security/integrity enforcement.

Attempting to delete:

```text
Candidate
Permanent
missing Entity
```

must fail clearly.

---

# 18. Transaction Boundary

Deletion must be atomic.

Conceptually:

```text
BEGIN

verify RETIRED

inspect historical references

if references:
    create tombstone

remove Entity from working store

append ENTITY_DELETED AuditEvent

COMMIT
```

Failure anywhere:

```text
ROLLBACK
```

No state where:

```text
Entity gone
+
no tombstone/audit explanation
```

is acceptable.

---

# 19. Audit

Retirement already deserves/uses lifecycle auditing.

Deletion adds:

```text
ENTITY_DELETED
```

Suggested AuditEvent details:

```text
entity_id
last_known_name
had_historical_references
tombstone_created
reason? / user note? (optional, not required V1)
```

Audit remains append-only and tamper-evident.

---

# 20. Notification Behavior

Successful retirement:

```text
INFO or SUCCESS
"Entity retired"
```

Successful deletion:

```text
SUCCESS
"Entity deleted"
```

Failure:

```text
ERROR
"Entity could not be deleted"
```

NotificationEvent remains presentation history.

AuditEvent remains authoritative history.

---

# 21. Recent / Pinned Cleanup

On successful deletion:

```text
remove Entity ID from Recent
remove Entity ID from Pinned
```

These are local UI preferences and do not need AuditEvents.

If selected Entity is deleted:

```text
clear selection
remove entity query parameter
show honest empty Inspector
```

---

# 22. URL Behavior

If the current URL is:

```text
/entities?entity=<deleted-id>
```

after deletion:

```text
/entities
```

or equivalent clean Entities route.

Directly navigating later to a deleted Entity ID should not silently recreate or expose it as an active Entity.

Potential response:

```text
Entity no longer exists in working population.
Historical references remain preserved.
```

Only add tombstone-detail navigation if a real historical workflow requires it.

---

# 23. New Entity Numbering

Deletion must not affect the monotonic creation counter.

Example:

```text
New Entity 30
→ Retire
→ Delete

next creation
→ New Entity 31
```

Never reuse:

```text
New Entity 30
```

---

# 24. Right-Click Behavior Across Responsive Modes

Desktop:

```text
anchored context menu at pointer location
```

Constrained/narrow:

Right-click/long-press support may be less reliable on touch.

The Inspector remains the guaranteed accessible home for lifecycle actions.

Therefore:

```text
context menu
= convenience surface

Inspector Actions
= canonical accessible surface
```

No feature may exist only in the context menu.

---

# 25. Touch

Do not require long-press support in the first implementation.

If browser/native context-menu interception behaves reliably under touch later, it may be added.

For V1:

```text
desktop right-click + keyboard context menu
+
Inspector action buttons
```

is sufficient.

---

# 26. Suggested API

Conceptually:

```text
POST /api/entities/:id/retire
DELETE /api/entities/:id
```

or equivalent application-service commands.

Do not implement delete as generic repository removal exposed directly to routes.

Use:

```text
EntityLifecycleService
or
EntityApplicationService
```

to own eligibility, tombstone, transaction, audit, and cleanup semantics.

---

# 27. Suggested Persistence Additions

Potential:

```text
entity_tombstone
```

table.

Minimum indexes:

```text
entity_id primary/unique
deleted_at
```

Historical reference resolution should remain efficient.

---

# 28. Tests

Required:

```text
Candidate cannot Delete
Permanent cannot Delete

Candidate can Retire
Permanent can Retire if existing lifecycle rules allow it

Retired Entity can Delete

unreferenced Retired Entity delete succeeds

referenced Retired Entity delete:
- creates tombstone
- removes working Entity
- preserves Experience
- preserves ExperienceEvent
- preserves PromotionDecision
- preserves lineage evidence
- preserves Audit history

ENTITY_DELETED AuditEvent is atomic with deletion

failure to append audit rolls deletion back

deleted Entity disappears from working search/table

deleted Entity removed from Recent/Pinned

selected deleted Entity clears selection/URL

monotonic New Entity counter does not reuse number

context menu and Inspector expose same lifecycle actions

keyboard context-menu access works
```

---

# 29. Risk Tier

Proposed:

```text
right-click context menu UI      Tier 2
Retire action wiring             Tier 2
Entity tombstone persistence     Tier 3
Delete transaction/audit         Tier 3
historical reference resolution  Tier 3
```

Because deletion touches immutable research reference integrity, the persistence portion deserves the workflow's targeted Tier-3 review.

---

# 30. GPT Recommendation

GPT recommends:

```text
Retire first
Delete second
Tombstone when historical references exist
```

rather than blocking deletion forever for any Entity that has entered research.

Reason:

It satisfies the user's desired cleanup workflow while preserving Paper Lab's central reproducibility guarantee.

The working application should not force the user to retain unwanted retired Entities merely because historical evidence still needs an identity anchor.

---

# 31. Questions for Claude

## Q1 — Two-stage lifecycle

Do you agree:

```text
Candidate/Permanent
→ Retire only

Retired
→ Delete available
```

?

---

## Q2 — Meaning of Delete

Do you agree that Delete should mean:

```text
remove from working Entity population
```

rather than:

```text
erase all historical evidence
```

?

---

## Q3 — Tombstone

Do you agree with an immutable minimal `EntityTombstone` for deleted retired Entities that still have historical references?

If not, what mechanism should preserve historical identity resolution while honoring the user's desire to delete retired Entities?

---

## Q4 — Unreferenced deletion

For an unreferenced retired Entity, should Paper Lab:

```text
physically remove it without tombstone
```

or create a tombstone for every deletion for consistency?

GPT currently prefers:

```text
tombstone only when needed for historical resolution
```

but is open to always-tombstone if the simpler invariant is worth the tiny storage cost.

---

## Q5 — Context menu

Do you agree with:

```text
right-click object
→ shared Entity action context menu

Inspector
→ same underlying action definitions
```

?

---

## Q6 — Confirmation

Do you agree Retire and Delete are both appropriate uses of blocking confirmation modals?

---

## Q7 — Audit atomicity

Do you agree `ENTITY_DELETED` plus tombstone/removal must commit atomically?

---

## Q8 — Risk tier

Do you agree tombstone/delete/reference-resolution work is Tier 3 even though the context-menu UI itself is Tier 2?

---

# 32. Separate Manager Review Request — Current Project State

In addition to reviewing the Retire → Delete proposal above, please perform your standing manager-review responsibilities against the **current project state**.

Current baseline to review:

```text
paper_labs_1.3.9.zip
```

This request is intentional and separate from the feature-design questions.

Please review the project as it exists now rather than relying only on prior handoffs.

---

# 33. Required Current-State Review Tasks

Please complete the established manager/milestone review duties, including:

```text
1. Verify current archive/version identity.

2. Review the current manifest/changelog against actual changed files.

3. Perform DOC/CODE ALIGNMENT review against:
   docs/
   collaboration/
   accepted frontend amendments
   architecture amendments
   decisions/deviations logs.

4. Confirm prior HIGH/MEDIUM findings are actually resolved in source.

5. Check that the 1.3 responsive shell remains faithful to the closed design.

6. Review current Notification system/history implementation after the
   1.3.4–1.3.9 corrections.

7. Review Live watchlist/context-menu behavior.

8. Review Entities table/filter/search/responsive behavior.

9. Review Console ownership of observability/diagnostics.

10. Check for implementation drift, duplicated logic, dead paths,
    inaccessible controls, or patch-layer accumulation.

11. Sanity-check current risk-tier classifications.

12. Flag any places where GPT appears to have guessed at an ambiguous spec.

13. Verify no settled decision exists only in collaboration discussion
    while code/docs disagree.

14. Review tests and call out materially missing coverage.

15. Classify findings:
    BLOCKER
    HIGH
    MEDIUM
    LOW
    SUGGESTION.
```

Please explicitly state whether the current `1.3.9` frontend milestone is:

```text
READY TO CLOSE
READY WITH CORRECTIONS
NOT READY TO CLOSE
```

---

# 34. Workflow Reminder

Claude remains manager/reviewer and may challenge:

```text
architecture
spec gaps
risk tier
implementation quality
weak points
failure modes
```

If Claude believes code takeover/rescue is warranted, follow the established rescue workflow:

```text
state rationale
state trigger/condition
state exact scope
wait for user authorization
```

Do **not** self-initiate project edits from this review alone.

---

# 35. Requested Response

Please return two clearly separated sections:

```text
PART A
Entity Retire → Delete Design Review

PART B
paper_labs_1.3.9 Current-State Manager Review
```

For Part A:

```text
ACCEPT
ACCEPT WITH REFINEMENTS
DISAGREE
```

For Part B:

```text
READY TO CLOSE
READY WITH CORRECTIONS
NOT READY TO CLOSE
```

with severity-classified findings and concrete source-backed reasoning.

This allows the deletion feature discussion and the current milestone quality review to proceed in one Claude pass without conflating them.
