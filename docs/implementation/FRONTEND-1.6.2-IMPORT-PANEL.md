# Frontend 1.6.2 — Portable Import Panel Consistency

Portable Import is a persistent right-side panel, matching Notification History's panel geometry and dismissal model rather than a floating flyout.

- Opens from Entity/Arena object or selected-object Import controls.
- Re-clicking the same Import control toggles the panel closed.
- Close button, Escape, and clicking outside close it.
- Opening Notifications closes Import; opening Import closes Notifications so the right-side utility surfaces never compete.
- Desktop uses the same width token as Notification History; constrained/narrow modes use the same responsive widths.
- Object-panel Import buttons use the standard 2rem button height, matching the adjacent + icon buttons.
- Import planning/application semantics are unchanged.
