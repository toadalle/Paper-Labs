# Frontend 1.3.4 — Notification Burst Queue

## Problem

Rapid notification creation exposed two independent presentation problems:

1. the live toast list truncated to five cards and dropped older visible notifications;
2. full application rerenders recreated CSS countdown elements, causing visual countdown resets/stutter.

## Corrected model

```text
NotificationEvent
    ↓
Toast enqueue
    ↓
active slots available?
    ├─ yes → visible toast → start its own active-display timer
    └─ no  → pending queue (timer has not started)
                        ↓
             visible slot becomes free
                        ↓
                  promote toast
                        ↓
              start full duration
```

The visible stack limit is 5. It is no longer a data-loss/truncation mechanism.

## Rendering boundary

Toast DOM is mounted outside `#app`.

Normal `render()` calls can replace `#app.innerHTML` without replacing active toast nodes.

Progress bars are updated from actual remaining time with `requestAnimationFrame`; no CSS keyframe is restarted by unrelated application state changes.

## Background behavior

When Paper Lab is hidden or loses focus:

- active toast timers pause,
- remaining time is captured,
- progress rendering pauses.

When active again, each visible toast resumes from its own remaining time.

Queued toast clocks have not started yet.

## Persistence

Client toast identity and persisted `NotificationEvent.id` are separate.

Asynchronous persistence cannot rename/re-key a live timer.

## Acceptance

- burst notifications are not dropped;
- no more than five transient cards cover the app at once;
- queued count is visible;
- each queued notification gets full visible duration after promotion;
- unrelated application renders do not reset progress bars.
