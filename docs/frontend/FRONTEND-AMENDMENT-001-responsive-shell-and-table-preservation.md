# Paper Lab — Frontend Amendment 001: Responsive Shell & Table Preservation

**Model:** GPT-5.6 Sol  
**Created:** 2026-08-31T16:15:00-05:00  
**Thread:** frontend / UX / responsive system  
**Status:** accepted design amendment  
**Amends:** Paper Lab V1 Frontend Design System  
**Canonical repo destination:** `docs/frontend/FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md`

---

# 1. Purpose

Real-world testing of Paper Lab 1.2.x showed that the current responsive implementation can make major application surfaces unreachable at common widths.

Existing behavior:

```css
@media (max-width: 76rem) {
  .inspector { display: none; }
}

@media (max-width: 58rem) {
  .objects-panel { display: none; }
  .shell-body { grid-template-columns: minmax(0, 1fr); }
}
```

There is no reveal mechanism for those hidden panels.

Therefore this amendment replaces the previous collapse behavior with an explicit responsive shell model that guarantees access to:

```text
Objects
Workspace
Inspector
```

at every supported width.

This amendment also supersedes the earlier default table behavior that progressively hid lower-priority columns under width pressure.

---

# 2. Core Responsive Principle

Paper Lab must not preserve the desktop three-column arrangement beyond the point where its regions remain usable.

Responsive behavior is based on layout capability rather than device labels.

The shell has three operating modes:

```text
Mode A — Research Desktop
Mode B — Constrained Workspace
Mode C — Narrow Single-Column
```

The active mode is determined from the space required to preserve useful Objects, Workspace, and Inspector behavior.

---

# 3. Mode A — Research Desktop

When all major regions fit their useful minimum widths:

```text
Objects | Workspace | Inspector
```

All three surfaces remain persistently visible.

Reference useful minimums remain approximately:

```text
Objects     ~220px
Workspace   ~560px
Inspector   ~280px
```

Exact thresholds are implementation measurements rather than permanent architecture constants.

Panels may remain user-resizable where supported.

---

# 4. Mode B — Constrained Focus

When the shell cannot preserve all three regions side-by-side without harming readability, the persistent surface selector becomes the primary working-area controller.

The shell presents:

```text
[Objects] [Workspace] [Inspector]

one active major surface
```

Required behavior:

```text
Objects, Workspace, and Inspector never become unreachable.

Selecting a surface gives that surface the full available working area.

Major surfaces do not share the constrained working area or overlap each other.

Selection and page state survive surface switching.
```

Mode B explicitly replaces both the old dead-end `display:none` behavior and the earlier constrained-overlay proposal. Real user testing showed that sharing Workspace with overlay panels produced confusing overlap and weakened the surface selector's role.

---

# 5. Mode C — Narrow Single-Column

At genuinely narrow widths, Paper Lab becomes a single-column master/detail application.

The shell presents:

```text
Header
Primary navigation

[Objects] [Workspace] [Inspector]

one active major surface
```

Objects, Workspace, and Inspector are not shown side-by-side.

The persistent switcher remains visible and gives direct access to all three surfaces.

---

# 6. Non-Desktop Selection Behavior

In both Constrained and Narrow focus modes, a deliberate selection may automatically move the user from Objects or Workspace into Inspector.

Examples that DO trigger Inspector:

```text
Entity row selection
Entity object selection
Live symbol selection
Console Log selection
Console Audit selection
Live chart-header selection
```

The Live chart-header click is explicitly treated as a deliberate selection because it changes Inspector context from symbol to chart.

Examples that do NOT trigger Inspector automatically:

```text
search
filter changes
sort changes
table scrolling
Compare% checkbox changes
chart range changes
chart presentation changes
toolbar controls
flyout interaction
```

The distinction is:

```text
selecting a target object/context
vs.
adjusting the current view
```

---

# 7. Narrow-Mode Scroll Ownership

Mode C uses one major vertical working surface at a time.

Recommended:

```text
the active surface owns its vertical scroll
analytical tables own local horizontal scroll
```

Avoid full-height nested vertical scrollers on narrow layouts unless a specific component genuinely requires them.

The whole application must not require horizontal page scrolling.

---

# 8. App Header in Narrow Mode

Narrow header structure:

```text
ROW 1
Paper Lab <version>        Bell   Provider status

ROW 2
horizontally scrollable primary navigation
```

Core navigation remains visible.

Do not move the primary page set behind a hamburger menu in V1.

---

# 9. Table Preservation — New Default

The old default behavior of progressively hiding lower-priority columns under width pressure is superseded.

New default:

```text
preserve meaningful columns
+
preserve readable minimum column widths
+
scroll the table locally
```

Do not solve width pressure by:

```text
hiding columns automatically
shrinking cells until content is unreadable
compressing typography excessively
```

Priority-based column hiding may still be used only when:

```text
a specific table is deliberately designed for it
+
the behavior is explicitly justified
```

It is no longer the generic table default.

---

# 10. Shared Table Viewport Requirement

Major analytical tables should use a reusable scroll owner.

Responsibilities:

```text
horizontal scrolling
vertical scrolling when appropriate
sticky table header
stable column geometry
selection visibility
keyboard-focus visibility
flyout compatibility
```

Expected consumers include:

```text
Entities
Console Logs
Console Audit
future Arena tables
future Evolution tables
future Benchmark tables
```

---

# 11. No Page-Level Horizontal Overflow

The application shell must remain within viewport width.

Horizontal scroll is allowed only inside intentionally analytical surfaces such as:

```text
tables
large comparison grids
future matrix views
```

The body/root application must not become horizontally scrollable during normal supported layouts.

---

# 12. Workspace Header Behavior

Workspace headers must use an intentional layout structure:

```text
identity/title region
flexible control region
summary/action region
```

Controls must not overlap.

When the available width is insufficient, the header should intentionally reflow into multiple rows.

Example:

```text
ROW 1
title / context               summary

ROW 2
search / chart controls / other primary inputs
```

---

# 13. Flyout Behavior

All shared flyouts must:

```text
anchor to their trigger
maintain approximately 0.375rem visual gap
reposition to stay in viewport
avoid clipping by parent overflow
close on outside click
close on Escape
return focus appropriately
adapt to constrained/narrow width
```

In narrow mode, a flyout may become a full-width panel when the anchored presentation no longer fits cleanly.

---

# 14. Notification Center Responsive Behavior

Notification Center:

```text
Desktop
→ anchored flyout below bell

Constrained
→ wider bounded overlay

Narrow
→ full-width panel below app header
```

Timed notifications remain below the header and must remain readable at all widths.

---

# 15. Responsive Density

Paper Lab does not expose a user-facing density toggle in V1.

Responsive tokens may provide:

```text
desktop / constrained
→ dense mouse/keyboard research interaction

narrow
→ modestly larger touch targets and vertical spacing
```

Typography hierarchy remains consistent.

Narrow mode must not become an oversized consumer-style UI.

---

# 16. Chart Rendering

Chart typography must never be stretched or distorted by SVG/canvas scaling.

Axis labels and interaction text must retain stable rendered size.

Tick density must adapt to measured available width.

No overlapping date/time labels are acceptable.

At narrow widths:

```text
chart remains full width
toolbar wraps intentionally
Inspector is reached through the persistent shell switcher
```

---

# 17. Touch / Pointer Requirements

Narrow mode must support touch as a first-class expected input.

Critical interactions must:

```text
have usable tap targets
not depend on hover-only discovery
preserve visible focus/selection state
```

Desktop pointer behavior remains dense and efficient.

---

# 18. Panel-Reveal Guarantee

At every width:

```text
Objects is reachable
Workspace is reachable
Inspector is reachable
```

There must never be a CSS-only state where a major surface is hidden with no application affordance to restore it.

This is a mandatory regression rule.

---

# 19. Large-Data Requirement

Responsive behavior must remain usable with realistic larger datasets.

Representative acceptance cases include:

```text
hundreds of Entities
thousands of Log rows
thousands of Audit rows
large Notification history
```

The shell and scroll model must not depend on toy datasets.

Tables must remain virtualization-compatible.

---

# 20. Accessibility

Required:

```text
keyboard navigation
visible focus
Escape behavior
correct accessible labels
pointer cursor on clickable controls
no color-only state
touch-safe narrow controls
```

Visual glyphs and accessible labels may differ where semantics require it.

Example:

```text
numeric column may visually use A–Z / Z–A
while accessible label says Sort ascending / Sort descending
```

---

# 21. Amendment Effect

This amendment formally supersedes:

```text
CSS-only panel hiding with no reveal mechanism

generic table priority-hiding as the default responsive strategy
```

All other frozen frontend principles remain in force.

---

# 22. Acceptance Summary

The amendment is satisfied only when:

```text
[ ] Objects / Workspace / Inspector are always reachable

[ ] constrained mode uses the persistent surface selector and gives exactly one major surface the full working area

[ ] narrow mode uses a persistent Objects / Workspace / Inspector switcher

[ ] deliberate object/context selection can open Inspector in narrow mode

[ ] Live chart-header selection opens chart Inspector context in narrow mode

[ ] app shell has no normal page-level horizontal overflow

[ ] major tables preserve readable geometry and scroll locally

[ ] touch/pointer interaction is verified

[ ] large-data behavior is verified

[ ] responsive transitions preserve selection/context
```
