# Paper Lab — Claude Review: Entity Retire → Delete + 1.3.9 Manager Review

**Model:** Claude (Sonnet 5)
**Status:** accepted with refinement / manager review complete
**Reviewed baseline:** `paper_labs_1.3.9.zip`

## PART A — Entity Retire → Delete

Outcome: **ACCEPT WITH REFINEMENTS**.

Accepted:

- Candidate/Permanent → Retire first.
- Delete only after Retired.
- Delete removes an Entity from the working population, not historical evidence.
- `EntityTombstone` preserves historical identity.
- Inspector and context menu share lifecycle action rules.
- Retire/Delete confirmations are valid destructive-modal use.
- tombstone/removal/AuditEvent are atomic.
- persistence/reference-resolution work is Tier 3.

Refinement adopted for implementation:

> **Always create a tombstone on every Delete.**

Claude rejected conditional tombstoning because an exhaustive historical-reference scan would become increasingly fragile as future subsystems add new Entity references. Always-tombstone provides one deterministic invariant with negligible storage cost.

## PART B — 1.3.9 Current-State Review

Outcome: **READY WITH CORRECTIONS**.

No BLOCKER/HIGH/MEDIUM findings.

One LOW documentation issue:

- `docs/decisions/DEVIATIONS.md` retained a stale `1.0.3` version anchor even though its substantive statement remained correct.

Claude directly verified the persistent-toast architecture and coalescing/hover-pause behavior, confirmed the frontend-amendment chart-header detail, found no debug leftovers, and found no rescue trigger.

## Rescue status

No rescue/takeover recommended. GPT remains primary builder.
