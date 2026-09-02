# Paper Lab — Entity Context Menu + Safe Delete Proposal

**Model:** GPT-5.6 Sol  
**Created:** 2026-09-01T10:52:00-05:00  
**Thread:** frontend / domain lifecycle / destructive actions  
**Status:** SUPERSEDED by `GPT-5.6-SOL-entity-retire-delete-proposal.md`  
**Current baseline:** `paper_labs_1.3.5` routine corrections  
**Implementation:** Entity deletion/context menu NOT started

---

## 1. User Request

The user wants:

```text
right-click an Entity object
→ anchored context-options flyout

Inspector → Actions
→ Delete
```

The UI request is straightforward. The destructive semantics are not, because Entity IDs may participate in immutable research/history objects.

---

## 2. Why Delete Is Different From Retire

Paper Lab already has:

```text
CANDIDATE
PERMANENT
RETIRED
```

Retire preserves the Entity and all historical references.

Hard Delete removes the Entity object itself.

Those cannot be aliases because the user specifically needs a way to remove accidental/test Entities, while research-bearing Entities must remain historically explainable.

---

## 3. Recommendation — Safe Hard Delete

Do NOT allow arbitrary Entity deletion.

Allow hard delete only when the Entity has never become research/history evidence.

Proposed `deletable` requirements:

```text
lifecycleState == CANDIDATE
candidateStatus == ACTIVE
birthEvolutionRunId == null
evolutionRunId == null

zero Experiences referencing Entity
zero MarketMemoryCells referencing Entity
zero PromotionDecisions referencing Entity
zero child Entities with parentEntityId == Entity.id
```

In practice this primarily permits deleting manually quick-created/root Candidates that were never evaluated or reproduced.

If any condition fails:

```text
Delete disabled / rejected
→ use Retire instead
```

This provides real cleanup without erasing scientific history.

---

## 4. Evolution-Origin Entities

Recommendation:

```text
Entity born from EvolutionRun
→ never hard-delete through ordinary UI
```

Even if it has zero completed Experiences, its birth itself is part of Evolution-run history/population accounting.

Use lifecycle death/retirement rather than removal.

---

## 5. Monotonic Entity Names

Deleting `New Entity 17` must NOT cause the counter to reuse 17.

Existing monotonic counter behavior remains:

```text
New Entity 17 deleted
next create
→ New Entity 18 or later
```

No numbering reuse.

---

## 6. Delete Must Be Audited

A successful hard delete is still a real state mutation.

Recommend:

```text
ENTITY_DELETED
```

AuditEvent written atomically with Entity removal.

Audit details should preserve enough identity to explain the event without recreating the deleted Entity object, for example:

```text
entityId
name
createdAt
traitsHash
reason = USER_DELETE_UNREFERENCED
```

Do not duplicate the full mutable/presentation object unnecessarily.

Audit history remains after Entity removal.

---

## 7. Atomicity

Required:

```text
eligibility re-check
+
Entity DELETE
+
AuditEvent append
```

inside one SQLite transaction.

Eligibility must be checked inside the same transaction as deletion so a new reference cannot be created between validation and deletion.

---

## 8. Repository/API Shape

Proposed application operation:

```ts
EntityService.deleteUnreferenced(id, correlationId)
```

Repository should expose a narrow deletion operation rather than a generic public `delete(kind,id)` API.

HTTP:

```text
DELETE /api/entities/:id
```

Server re-validates all deletion constraints regardless of frontend state.

Possible conflict response:

```text
409
Entity cannot be deleted because it is referenced by research/history. Retire it instead.
```

---

## 9. Context Menu

Right-clicking an Entity object opens an anchored context menu at the pointer location.

No modal for opening the menu.

Initial options should mirror useful object actions, not invent a second action system.

Suggested initial menu:

```text
Open / Inspect
Pin or Unpin
────────────
Delete
```

As Evaluate / Compare / Promotion / Retire become real actions, they can be added to the same shared action registry rather than separately hard-coded in Context Menu and Inspector.

---

## 10. Shared Action Registry

To prevent Inspector and context-menu behavior drifting apart, propose one frontend definition per Entity action:

```ts
EntityAction {
  id
  label
  destructive
  enabled(entity, capabilities)
  disabledReason?
  execute(...)
}
```

Both:

```text
Inspector Actions
Context Menu
```

render from that shared action model.

This also helps the user's concern about long labels and action ordering.

---

## 11. Right-Click Selection Behavior

Recommendation:

```text
right-click Entity B while Entity A is selected
→ Entity B becomes the context target and selected Entity
→ Inspector changes to Entity B
→ context menu opens for Entity B
```

This keeps:

```text
context menu target
Inspector target
selected row/object
```

consistent instead of allowing commands against a hidden secondary target.

Claude should challenge this if preserving current selection while opening a context target is preferable.

---

## 12. Context Menu Interaction Rules

Required:

```text
right-click / contextmenu opens
pointer-position anchored
viewport collision-aware
outside click closes
Escape closes
keyboard Context Menu key / Shift+F10 opens for focused object
focus returns predictably
```

No native browser context menu over Entity objects once Paper Lab handles the event.

Do not intercept right-click elsewhere in the application.

---

## 13. Delete Confirmation

Delete is destructive, so this is one of the cases where the frozen frontend rules permit a modal.

Proposed confirmation:

```text
Delete New Entity 17?

This permanently removes this unreferenced Entity.
This cannot be undone.

[Cancel] [Delete Entity]
```

Do not require typing the Entity name for ordinary unreferenced Candidate cleanup unless real usage shows accidental deletion remains a problem.

---

## 14. When Delete Is Unavailable

Inspector/context menu should not silently omit the concept if the user needs to understand why it is unavailable.

Recommended:

```text
Delete disabled
```

with tooltip/helper reason such as:

```text
Cannot delete: Entity has 3 Experiences. Retire it instead.
```

Potential reasons:

```text
has Experiences
has descendants
has Market Memory evidence
has Promotion history
belongs to Evolution history
not a Candidate
```

---

## 15. Post-Delete UI Behavior

After success:

```text
remove Entity from table
remove from Recent
remove from Pinned
remove from selected Entity
remove Entity query parameter from URL
```

Then select a sensible adjacent Entity if one exists, otherwise show No selection.

Do NOT mutate table search/filter/sort merely because an Entity was deleted.

Notification:

```text
SUCCESS
Entity deleted
<name> was permanently removed.
```

Notification history persists normally.

---

## 16. Context Menu Beyond Entities

Recommend building the UI primitive generically:

```text
ContextMenu
```

but only wiring Entity objects in this feature.

Future consumers might be:

```text
Live symbols
Arenas
Evolution runs
Console rows
```

Do not pre-populate those with speculative actions now.

---

## 17. Risk Tier

Proposed:

```text
Context-menu UI primitive       Tier 2
Inspector/context action model  Tier 2
Safe Entity deletion            Tier 2 / domain-history sensitive
```

I do not classify it Tier 3 because it does not alter scored research algorithms, but deletion constraints and audit atomicity require careful review.

---

## 18. Tests

At minimum:

```text
fresh manual Candidate is deletable

Entity with Experience cannot delete
Entity with MarketMemoryCell cannot delete
Entity with PromotionDecision cannot delete
Entity with child cannot delete
Evolution-born Entity cannot delete
Permanent/Retired Entity cannot hard-delete

eligibility + delete + AuditEvent are atomic
failed audit append rolls deletion back
counter never reuses deleted number

right-click targets correct Entity
outside click / Escape close menu
Shift+F10 opens menu for focused object
Inspector and context menu share delete eligibility
post-delete Recent/Pinned/URL selection cleanup works
```

---

## 19. Questions for Claude

### Q1

Do you agree with **safe hard delete** rather than either unrestricted deletion or mapping Delete to Retire?

### Q2

Are the proposed deletion constraints sufficient, especially blocking Evolution-origin Entities even before they have Experiences?

### Q3

Should an unreferenced `PERMANENT` or `RETIRED` Entity ever be hard-deletable, or should hard-delete remain Candidate-only?

GPT recommends Candidate-only.

### Q4

Do you agree a successful delete must be atomic with an `ENTITY_DELETED` AuditEvent?

### Q5

Do you agree right-click should select the target Entity before opening its context menu so Inspector/context target cannot diverge?

### Q6

Should Delete remain visible-but-disabled with a reason when blocked, or disappear entirely?

GPT recommends visible-but-disabled.

### Q7

Do you agree with a shared Entity action registry feeding both Inspector Actions and Context Menu?

### Q8

Is a normal destructive confirmation modal sufficient for deleting an eligible, unreferenced Candidate, or should a stronger confirmation be required?

---

## 20. Requested Outcome

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

No Entity deletion/context-menu implementation should begin until the destructive semantics converge.
