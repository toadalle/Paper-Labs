# Paper Lab — Observability Implementation Reference

Architecture Amendment 002 freezes the guarantees. This document records the living implementation details.

## Evidence boundaries

```text
LogEvent        = operational diagnostics
AuditEvent      = durable application/action history
ExperienceEvent = scientific/evaluation evidence
```

## Operational logs

- console + `data/logs/paper-lab-YYYY-MM-DD.ndjson`
- best-effort file sink; console remains fallback
- structured events with request/correlation IDs
- explicit sensitive-key redaction
- operational logging failure does not roll back otherwise-valid research work

## Audit

- stored in SQLite `audit_events`
- append-only application API
- monotonically sequenced
- SHA-256 canonical hash chain
- deterministic integrity verification
- research-critical mutations and required AuditEvents share the same SQLite transaction

## Diagnostics

`GET /api/diagnostics` returns a sanitized JSON payload with:

- product/system manifest
- object counts
- provider capability state
- audit integrity state
- recent AuditEvents

Credentials and `.env` contents are not included.

## Research validity

`ResearchIntegrityService.compromiseSnapshot(...)` atomically:

1. transitions the snapshot to `COMPROMISED`
2. appends the snapshot audit event
3. transitions every referencing Experience from `VALID` to `COMPROMISED_SOURCE`
4. appends an audit event for each invalidated Experience

`SUPERSEDED` does not invalidate historical Experiences.

## Stored market-data integrity trigger

`ResearchIntegrityService.compromiseSnapshot(...)` is intentionally not exposed as a generic "mark compromised" user action.

`MarketDataIntegrityService` verifies persisted snapshot artifacts against each snapshot's recorded `contentHash`.

```text
stored artifact
    ↓
SHA-256 verification
    ↓
match
→ remains valid

hash mismatch / unreadable artifact
    ↓
ResearchIntegrityService.compromiseSnapshot(...)
    ↓
atomic snapshot compromise + Experience invalidation + AuditEvents
```

The service runs an integrity sweep during application startup before the HTTP server begins listening.

A manual evidence-driven recheck is also available through:

```text
POST /api/market-data/integrity/verify
```

This endpoint performs verification; it does not accept a user-supplied "compromise" flag or reason.

Provider-side source revisions are handled by the separate snapshot supersession path and remain `SUPERSEDED`, not `COMPROMISED`.
