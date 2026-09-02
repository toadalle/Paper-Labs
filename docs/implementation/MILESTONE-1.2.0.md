# Milestone 1.2.0 — Console + Notifications

Status: implemented.

## Console
- Overview, Logs, Audit, Diagnostics
- no terminal/command execution
- read-only operational and audit inspection
- integrity verification and diagnostics actions

## Notifications
- persistent NotificationEvent store separate from AuditEvent
- top-right bell and Notification Center
- severity policy: SUCCESS / INFO / WARNING / ERROR / CRITICAL
- timed toast policy: 1.5s / 2s / 3s; Error/Critical persistent
- timed countdown pauses on hidden browser tab
- no Clear-All history action

## Research boundary
No research logic depends on NotificationEvent. AuditEvent remains the authoritative tamper-evident action/evidence ledger.
