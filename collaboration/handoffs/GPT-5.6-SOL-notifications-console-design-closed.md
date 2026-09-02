# Paper Lab — Notifications + Console Design Closure

**Model:** GPT-5.6 Sol  
**Thread:** frontend / observability / implementation  
**Status:** design closed for future milestone 1.2.0  
**Implementation in 1.1.2:** none

## Closed boundaries

```text
NotificationEvent = persistent user-facing activity/history
AuditEvent        = append-only/tamper-evident system + research history
LogEvent          = operational diagnostics
ExperienceEvent   = scientific/evaluation evidence
```

These objects are intentionally separate. NotificationEvent needs mutable presentation state (`seen`, `dismissed`), which is fundamentally incompatible with AuditEvent's append-only integrity guarantee.

## Notification severity

Use:

```text
SUCCESS
INFO
WARNING
ERROR
CRITICAL
```

Avoid `FATAL` in user-facing notification terminology because Logger already uses `fatal` to indicate application-level failure semantics.

## Toast lifetime policy

Centralized severity defaults, not per-call-site magic values.

Suggested starting policy:

```text
SUCCESS  timed, short
INFO     timed, short
WARNING  timed, longer (~3s)
ERROR    persistent until dismissed
CRITICAL persistent until dismissed
```

Only timed notifications show a bottom countdown/progress bar. Persistent ERROR/CRITICAL notifications do not show a static progress bar.

Timed countdowns pause while `document.hidden` and resume when the page becomes visible so warnings cannot expire unseen in a background tab.

Every toast has an `×` dismiss control.

## Notification Center

Header placement:

```text
... [bell] [Alpaca status]
```

Bell opens an anchored flyout, never a modal.

Notification history:

```text
persists
cannot be Clear-All deleted from UI
may track seen/dismissed state
is not research-authoritative
is virtualization-ready for long-term growth
```

Minimal V1 filtering:

```text
Is       → severity dropdown
Contains → free text over title/message/source label
```

Notification rows may link to relevant objects or Console correlations when a meaningful target exists.

## Console workspace

New top-level page for milestone 1.2.0:

```text
Live
Entities
Arenas
Evolution
Benchmark
Console
```

V1 Console Objects choices:

```text
Overview
Logs
Audit
Diagnostics
```

Do not add Recent Correlations until real usage demonstrates value.

### Overview

May show:

```text
application version
uptime/server state
database state
provider capability/configuration
audit integrity
audit-event count
recent warning/error count
market-data integrity status
last integrity check
```

### Logs

Read structured LogEvents with search/filter/sort/correlation inspection. No arbitrary shell/terminal execution and no log deletion control.

### Audit

Read-only AuditEvent browser showing sequence, event type, actor, subject, summary, correlation and integrity state. Detail opens in Inspector. No mutation/deletion.

### Diagnostics

Owns:

```text
Export diagnostics
Run audit-integrity verification
Run market-data artifact verification
```

This is also the intended user-facing home for the `MarketDataIntegrityService` verification trigger previously identified during the 1.0.2 baseline sweep.

## Live Inspector boundary

`Export diagnostics` does not belong permanently in Live's symbol/chart Inspector. Console owns system diagnostics. Contextual problems elsewhere may offer an `Open Console` shortcut once Console exists.

## Internal implementation order for 1.2.0

```text
Pass A — Console
Pass B — Notifications
```

Console comes first because Notifications may provide `Open Console` investigation links, while Console has standalone value even before Notifications exist.

## Review status

Claude accepted the design with these refinements. No further design round is needed before implementation planning for milestone 1.2.0 unless new requirements change the scope.
