# Paper Lab — Architecture Amendment 002: Audit & Research-Validity Guarantees

**Model:** GPT-5.6 Sol  
**Created:** 2026-08-31T10:12:00-05:00  
**Thread:** architecture / implementation  
**Status:** accepted / frozen amendment  
**Amends:** Paper Lab V1 Final Architecture Specification + Architecture Amendment 001  
**Scope:** guarantees only; logger/audit taxonomies and export formats remain implementation details

---

## 1. Purpose

Paper Lab requires a durable explanation of research-relevant state changes without confusing three separate evidence streams:

```text
LogEvent        = operational diagnostics
AuditEvent      = durable application/action history
ExperienceEvent = immutable scientific/evaluation evidence
```

This amendment freezes only the guarantees required for reproducibility and research integrity. It intentionally does **not** freeze the complete AuditEvent field taxonomy, every event name, log sink configuration, retention mechanics, or diagnostics export layout.

---

## 2. Operational Logging Is Best-Effort

Operational logging exists to diagnose software behavior.

A log sink failure must not, by itself, invalidate otherwise-correct research work.

If a file log sink fails, Paper Lab should fall back to another diagnostic sink when practical.

Operational logs are not source-of-truth research evidence.

---

## 3. Audit Is Durable and Append-Only

Research-relevant state changes must have a durable audit record.

Audit records are append-only application evidence.

Routine mutation and deletion of historical AuditEvents is prohibited.

An explicit destructive project reset may remove the project and its audit history as a deliberate administrative action, but ordinary application behavior must not rewrite historical audit records.

---

## 4. Audit Is Not Experience Evidence

`AuditEvent` must not duplicate the detailed scientific event stream already represented by `ExperienceEvent`.

```text
ExperienceEvent
= what happened inside an evaluation

AuditEvent
= what Paper Lab changed/decided and why
```

Audit records should reference Experiences and their evidence rather than copy all evaluation events into a second ledger.

---

## 5. Audit Is Not Event Sourcing

The audit ledger is not the primary source of current Paper Lab state.

Paper Lab must not require replaying AuditEvents to reconstruct ordinary domain state.

The architecture remains:

```text
domain/research state
+
immutable scientific evidence
+
durable audit explanation
```

---

## 6. Critical Mutation + Audit Atomicity

For a research-critical state mutation that requires an AuditEvent:

```text
domain mutation
+
AuditEvent append
```

must commit atomically in the same persistence transaction.

If the required AuditEvent cannot be persisted, the associated critical mutation must not commit.

This rule does **not** apply to ordinary best-effort operational logging.

Therefore the distinction is explicit:

```text
operational logger failure
→ does not normally block valid work

audit append failure for an audit-required mutation
→ blocks/rolls back that mutation
```

The persistence layer must provide a transaction/unit-of-work boundary sufficient to enforce this guarantee.

---

## 7. Audit Must Be Tamper-Evident

Audit history must support deterministic integrity verification.

V1 should use the existing canonical serialization and SHA-256 infrastructure to chain AuditEvents or provide an equivalently deterministic integrity mechanism.

The system should detect, at minimum:

```text
modified historical audit records
missing middle records
record reordering
broken chain/linkage
```

This guarantee is **tamper-evident**, not tamper-proof.

Paper Lab must not claim that a local database cannot be deliberately replaced or rewritten by someone with filesystem access.

---

## 8. Market-Data Compromise Propagates to Research Validity

Architecture Amendment 001 defines `MarketDataSnapshot.status = COMPROMISED` for source evidence that can no longer be trusted.

When a MarketDataSnapshot becomes `COMPROMISED`, every Experience that used that snapshot must become research-invalid for decisions that require trustworthy evidence.

Conceptually:

```text
MarketDataSnapshot
VALID/SUPERSEDED
        ↓
COMPROMISED
        ↓
referencing Experience
researchValidity → COMPROMISED_SOURCE
```

A merely `SUPERSEDED` snapshot does **not** compromise historical Experiences. Supersession means newer provider evidence exists; it does not retroactively corrupt the exact stored artifact used by an old Experience.

---

## 9. Experience General Immutability Remains Intact

A completed Experience remains immutable as scientific evidence.

Research-validity propagation must **not** reopen general Experience mutability.

Introduce a dedicated, narrow state transition analogous to the existing MarketDataSnapshot status transition:

```text
transitionExperienceResearchValidity(...)
```

or an equivalently narrow domain operation.

The permitted transition is research-validity metadata only; it does not authorize changing:

```text
reward
ExperienceEvents
Arena version
Entity identity
market-data snapshot references
execution evidence
completed timestamps
other completed scientific results
```

---

## 10. Research-Validity Transition Is Itself Audited Atomically

The transition:

```text
Experience.researchValidity
VALID → COMPROMISED_SOURCE
```

must be persisted atomically with the AuditEvent that explains the invalidation.

If that audit append fails, the research-validity transition must not partially commit.

The system must be able to explain:

```text
which snapshot became compromised
which Experiences were affected
when the invalidation occurred
which operation caused/recorded the transition
```

without altering the original scientific evidence.

---

## 11. Compromised Evidence Cannot Support Research Claims

An Experience whose research validity is `COMPROMISED_SOURCE` must not be accepted as valid evidence for:

```text
promotion decisions
Search Benchmark comparisons
research-valid survival/reward claims
deployment certification
```

Any future research consumer that requires valid historical evidence must explicitly enforce research-validity state rather than assuming all completed Experiences remain trustworthy forever.

Historical compromised Experiences remain preserved for audit/history.

They are excluded from trustworthy research claims until the Entity is re-evaluated against valid evidence.

---

## 12. Use-Triggered Immutability Remains the V1 Rule

The 1.0.0 implementation accidentally made several objects immutable immediately after creation.

The frozen architecture remains authoritative:

```text
Arena
→ may be edited before scored use
→ becomes immutable after first scored use

EvolutionPolicy
→ may be edited before governing scored work
→ becomes immutable after first scored use
```

Use-triggered locking should be recorded through audit history when implemented.

EvaluationSuite lifecycle must follow its canonical architecture definition and must not inherit a generic immediate-lock rule merely for repository convenience.

---

## 13. Entity Traits Are Birth-Immutable

An Entity's trait vector is part of its identity at birth.

After Entity creation, traits must not be edited in place.

Behavioral variation occurs through creation of a new Entity via the allowed proposal/reproduction mechanisms, not mutation of an existing Entity record.

This extends the existing immutable lineage/origin protections to `traits`.

---

## 14. Implementation Details Deliberately Not Frozen Here

The following belong in living implementation documentation rather than this architecture amendment:

```text
exact AuditEvent field names
complete event-type taxonomy
log file naming
log rotation/retention duration
console/file sink mechanics
diagnostics ZIP layout
UI presentation of logs/audit
specific logger library or implementation
```

Those details may evolve without reopening the frozen architecture as long as they continue to satisfy the guarantees above.

---

## 15. Risk Classification

The guarantees in this amendment affect:

```text
research validity
immutability
transaction correctness
reproducibility
audit integrity
```

Implementation of the audit transaction boundary and compromised-source propagation is therefore Tier 3 under the canonical workflow and receives the corresponding independent review.

Operational logger mechanics remain Tier 2 unless they cross into research-critical state handling.

---

## 16. Acceptance Criteria for Implementation

Before this amendment is considered implemented:

```text
[ ] audit-required mutations and their AuditEvents are atomic
[ ] audit history is append-only
[ ] audit integrity can be verified deterministically
[ ] operational log failure does not masquerade as audit failure
[ ] COMPROMISED snapshots invalidate referencing Experiences
[ ] SUPERSEDED snapshots do not invalidate Experiences
[ ] research-validity transition uses a dedicated narrow method
[ ] completed Experience scientific evidence remains immutable
[ ] compromised Experiences are rejected by research-decision consumers
[ ] invalidation transitions are themselves audited atomically
[ ] Entity traits cannot change after birth
[ ] Arena/Policy locking follows use-triggered immutability
```

---

## 17. Requested Claude Review

Please return:

```text
ACCEPT
ACCEPT WITH REFINEMENTS
DISAGREE
```

and identify any BLOCKER/HIGH/MEDIUM findings before implementation begins.

If accepted, this document becomes the frozen `ARCHITECTURE-AMENDMENT-002-audit-guarantees.md` target for the 1.0.2 corrective foundation build.
