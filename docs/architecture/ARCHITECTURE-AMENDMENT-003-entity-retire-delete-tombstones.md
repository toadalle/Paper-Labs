# Paper Lab — Architecture Amendment 003: Entity Retirement, Deletion & Tombstones

**Status:** accepted
**Applies from:** 1.4.0

## 1. Purpose

Paper Lab separates lifecycle retirement from removal of an Entity from the working population.

```text
Candidate / Permanent
→ Retire
→ Retired
→ Delete
```

Delete is never evidence erasure.

## 2. Retirement gate

Only a Retired Entity may be deleted from the working population.

The backend enforces this rule independently of frontend presentation state.

Retirement preserves the Entity record and its historical evidence. It transitions the Entity to `RETIRED`, clears Candidate-only state, clears active `evolutionRunId`, and records `retiredAt`.

## 3. Delete semantics

Deleting a Retired Entity means:

```text
remove the Entity from the working Entity population
+
preserve historical identity and immutable evidence
```

Delete must never cascade-delete Experiences, ExperienceEvents, PromotionDecisions, AuditEvents, Evolution history, MarketDataSnapshots, or other research-valid evidence.

## 4. Always-tombstone invariant

Every Entity deletion creates one immutable `EntityTombstone`, regardless of whether known historical references currently exist.

This avoids an exhaustive-reference check whose correctness would silently decay as future subsystems add new Entity references.

A tombstone is a minimal historical identity anchor, not a fourth lifecycle state and not a second full Entity record.

Minimum retained identity includes:

```text
Entity ID
last known name
family
original created time
deleted time
birth Evolution run ID
parent Entity ID
lineage mutation operator
lifecycle at deletion = RETIRED
```

## 5. Atomicity

The following must commit atomically:

```text
create immutable EntityTombstone
remove working Entity
append ENTITY_DELETED AuditEvent
```

Any failure rolls the entire mutation back.

An Entity may never disappear from the working store without both its tombstone and required AuditEvent.

## 6. Audit

Retirement records `ENTITY_RETIRED`.

Deletion records `ENTITY_DELETED`.

Audit remains append-only and tamper-evident. Notification history remains presentation state and is not authoritative evidence.

## 7. Historical references

Historical records keep their original Entity ID references. Future historical-detail rendering resolves identity through:

```text
working Entity
OR
EntityTombstone
```

Deleting an Entity does not rewrite immutable historical records merely to replace their IDs with tombstone IDs.

## 8. Working population

Deleted Entities are absent from ordinary Entity population views:

```text
Entities table
Recent
Pinned
search
normal lifecycle filters
```

`DELETED` is not added to `LifecycleState`.

## 9. IDs and default names

Deletion never reuses:

```text
Entity IDs
New Entity N sequence values
```

The persisted monotonic default-name counter continues forward after retirement and deletion.

## 10. UI access

Lifecycle actions must remain accessible from the Entity Inspector.

Desktop/keyboard users may also access the same underlying lifecycle action through an Entity context menu using right-click, Context Menu key, or `Shift+F10`.

No destructive capability may exist only in the context menu.

## 11. Confirmation

Retire and Delete are destructive/blocking transitions and are valid uses of confirmation modals under the frontend modal policy.

## 12. Acceptance

This amendment is satisfied when:

```text
[ ] Candidate/Permanent cannot Delete
[ ] Candidate/Permanent can Retire according to lifecycle rules
[ ] Retired can Delete
[ ] every Delete creates an immutable tombstone
[ ] historical evidence is not cascade-deleted
[ ] tombstone + working removal + AuditEvent are atomic
[ ] audit failure restores the Retired Entity and leaves no tombstone
[ ] Entity IDs/default sequence values are never reused
[ ] Inspector and context menu use one lifecycle-action rule
```
