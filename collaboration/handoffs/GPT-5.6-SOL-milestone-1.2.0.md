# Paper Lab — Milestone 1.2.0

**Model:** GPT-5.6 Sol  
**Thread:** implementation / observability  
**Status:** milestone implementation  
**Project version:** 1.2.0

## RESULT

Implemented the accepted Console + Notifications feature milestone and the dynamic Entities Workspace-header correction discovered during 1.1.2 testing.

## FILES CHANGED

See `collaboration/manifests/MANIFEST-1.2.0.json` for the objective archive file set.

Primary areas:

- `src/application/notifications/` — NotificationEvent application service.
- `src/infrastructure/persistence/repository.ts` — persistent notification-history table and presentation-state updates.
- `src/infrastructure/logging/logger.ts` — bounded recent-log reader for Console.
- `src/server/routes.ts` — notification, Console log/overview, and AuditEvent read endpoints.
- `src/frontend/pages/console.ts` — Overview / Logs / Audit / Diagnostics workspace.
- `src/frontend/main.ts` — Console navigation/state, bell/Notification Center, toast lifecycle, visibility-paused timers, notification persistence, Console actions.
- `public/styles.css` — header bell, Notification Center, top-right toast stack, Console UI, Workspace-container responsive search behavior.
- `tests/notification.test.ts` — NotificationEvent persistence/mutability-boundary tests.
- docs/decisions/README — milestone documentation and D-020.

## TESTS

`npm run check` passes with 40/40 automated tests.

Runtime smoke checks cover:

- version/bootstrap 1.2.0
- `/console` SPA route
- `/api/console/overview`
- `/api/console/logs`
- `/api/audit/events`
- notification create/list endpoints

## SPEC SECTIONS

Aligned with the accepted Notifications + Console design:

- NotificationEvent remains separate from AuditEvent and LogEvent.
- Console owns observability and diagnostics controls.
- Bell sits before Alpaca status.
- Toasts render top-right below the header.
- timed severity countdowns pause while the tab is hidden.
- Error/Critical notifications persist and have no countdown bar.
- Notification history exposes no Clear-All operation.

## DEVIATIONS

None intentionally accepted.

## RISKS

- Notification Center uses bounded paged loading with an explicit Load older action. True row virtualization can be added if history volume demonstrates the need.
- Operational logs are local NDJSON files and Console displays a bounded recent window. This is intentionally not a terminal or remote log aggregation system.

## FOLLOW-UP

User should test responsive header behavior, notification timing/placement, Notification Center filtering/history, and all Console views. This milestone should receive Claude milestone review after local testing.

## CHANGELOG

### Added — Console / Notifications
- `src/application/notifications/notification-service.ts` — creates and manages durable user-facing NotificationEvents.
- `src/frontend/pages/console.ts` — adds the Console workspace.
- `tests/notification.test.ts` — verifies notification history remains separate from AuditEvent and cannot be erased through dismissal.
- `docs/implementation/MILESTONE-1.2.0.md` — records implemented milestone boundary.

### Modified — Persistence / backend
- `src/domain/types.ts` — adds NotificationSeverity and NotificationEvent.
- `src/infrastructure/persistence/repository.ts` — adds notification persistence and seen/dismissed presentation updates.
- `src/infrastructure/logging/logger.ts` — adds bounded recent-log reading.
- `src/server/routes.ts` — adds notification and Console read/action APIs.

### Modified — Frontend
- `src/frontend/types.ts` — adds Console/notification transport views.
- `src/frontend/main.ts` — adds Console route, notification bell/center/toasts, timer policy, Console interactions.
- `public/styles.css` — adds Console/notification styling and fixes Workspace-header responsive behavior.

### Modified — Project metadata/docs
- `package.json`, `package-lock.json`, `src/domain/version.ts` — version 1.2.0.
- `README.md` — documents observability milestone.
- `docs/decisions/DECISIONS-LOG.md` — D-020 Notifications and Console.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED
- Notification history has mutable seen/dismissed presentation state; AuditEvent remains immutable/tamper-evident.
- Console owns diagnostics export and integrity checks rather than Live Inspector.
- Notification severity vocabulary is SUCCESS / INFO / WARNING / ERROR / CRITICAL.
- Timed notifications use severity defaults; Error/Critical persist.
- Persistent notifications do not show countdown progress bars.
- Countdown pauses when `document.hidden` is true.
- Notification Center has no Clear-All action.
- Console is built before Notifications conceptually and is the destination for deeper investigation.

### PENDING
- True row virtualization may be added when real notification/log volume demonstrates need; history is already paged and is not truncated by a Clear-All policy.

### UNRECORDED DECISION
- None known at packaging time.

### DEVIATION
- None known at packaging time.
