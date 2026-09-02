# Paper Lab — Frontend Makeover 1.3 Implementation Plan

**Model:** GPT-5.6 Sol  
**Created:** 2026-08-31T16:15:00-05:00  
**Thread:** frontend / implementation  
**Status:** implementation plan — design closed  
**Target archive:** `paper_labs_1.3.0.zip`  
**Depends on:** `FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md`

---

# 1. Milestone Objective

`1.3.0` is a frontend-system makeover.

It does not add major domain capabilities.

The goal is to make the existing Paper Lab interface coherent across:

```text
ultrawide
desktop
split-screen
tablet-like widths
phone-like widths
80–150% browser zoom
practical text scaling
mouse
keyboard
touch
```

without making any major application surface unreachable.

---

# 2. Headline Defect to Eliminate First

Current 1.2.x behavior contains:

```css
@media (max-width: 76rem) {
  .inspector { display: none; }
}

@media (max-width: 58rem) {
  .objects-panel { display: none; }
}
```

with no reveal mechanism.

This is the first implementation target.

No frontend-polish pass should proceed until:

```text
Objects
Workspace
Inspector
```

remain reachable across responsive transitions.

---

# 3. Milestone Passes

Implementation sequence:

```text
Pass A — Responsive shell architecture
Pass B — Shared responsive primitives
Pass C — Entities + Live makeover
Pass D — Notifications + Console makeover
Pass E — accessibility / touch / zoom / resize audit
Pass F — CSS/token cleanup + visual consistency
```

Each pass has its own completion gate.

---

# 4. Pass A — Responsive Shell Architecture

## A1. Remove dead-end collapse rules

Delete/replace CSS behavior that permanently hides:

```text
Inspector
Objects
```

without reveal controls.

## A2. Introduce explicit shell modes

Conceptual runtime state:

```ts
type ShellMode =
  | 'desktop'
  | 'constrained'
  | 'narrow';
```

Mode should be derived from actual available shell width/capability.

Avoid UA/mobile-device detection.

## A3. Desktop

```text
Objects | Workspace | Inspector
```

All visible.

## A4. Constrained

```text
Workspace remains persistent

Objects
→ left overlay

Inspector
→ right overlay
```

Add discoverable shell controls to summon each.

## A5. Narrow

```text
[Objects] [Workspace] [Inspector]

one active major surface
```

Persistent switcher.

## A6. Narrow selection behavior

Auto-switch to Inspector for deliberate selections:

```text
Entity
Live symbol
Live chart header
Console log
Console audit
future equivalent detail selections
```

Do not auto-switch for view adjustments.

## A7. Transition preservation

Resizing between modes must preserve:

```text
selected page
selected object
Inspector context
search
filters
chart state
Console selection
notification state
```

## A8. Page-overflow test

No application-level horizontal scroll.

### Pass A gate

```text
[ ] Inspector reachable at/under prior 76rem collapse width
[ ] Objects reachable at/under prior 58rem collapse width
[ ] overlays work
[ ] narrow switcher works
[ ] resize preserves state
[ ] no page-level horizontal overflow
```

---

# 5. Pass B — Shared Responsive Primitives

Build/refactor reusable UI behavior before feature-specific polish.

## B1. TableViewport

Responsibilities:

```text
horizontal scroll
optional vertical scroll
sticky headers
selection visibility
keyboard focus
stable flyout anchors
```

Use for:

```text
Entities
Console Logs
Console Audit
```

## B2. WorkspaceHeader

Structure:

```text
identity
flexible center controls
summary/actions
```

Allow intentional wrapping.

## B3. SearchControl

Standardize:

```text
clear behavior
debounce
Escape
focus
responsive width
no browser-native duplicate cancel
```

## B4. Flyout

One shared positioning/dismissal model:

```text
trigger anchor
~6px gap
viewport collision handling
outside click
Escape
focus return
narrow/full-width fallback
```

## B5. Segmented controls

Standardize chart ranges and similar control groups.

## B6. IconButton

Unify:

```text
bell
filter
sort
plus
pin
close
refresh
chevrons
```

### Pass B gate

```text
[ ] no bespoke filter-flyout positioning remains
[ ] table viewport reused by required tables
[ ] Workspace header no longer overlaps
[ ] shared control hit targets verified
```

---

# 6. Pass C — Entities Makeover

## C1. Objects

Standardize:

```text
title / +
shown-total
Recent
Pinned
```

## C2. Workspace header

Search remains centered/usable at desktop widths and intentionally reflows under pressure.

## C3. Table

Preserve columns.

Add/retain:

```text
faint vertical separators
sticky headers
selected-row state
hover state
focus state
local horizontal scroll
```

Do not hide columns automatically.

## C4. Filters

Ensure:

```text
flyout alignment
viewport-safe placement
zero-result table still exposes header/filter controls
```

## C5. Narrow behavior

Entities narrow workflow:

```text
Objects
→ choose/create Entity

Workspace
→ table/search/filter

Inspector
→ details/actions
```

Selection auto-switches to Inspector.

### Entities gate

```text
[ ] 360–480px widths usable
[ ] table remains fully accessible via local scroll
[ ] Quick Create still guarantees visibility
[ ] selecting Entity opens Inspector in narrow mode
[ ] filters/search remain unchanged by ordinary selection
```

---

# 7. Pass C — Live Makeover

## C6. Objects

Maintain:

```text
search
Investments
Crypto
Compare% checkboxes
```

## C7. Chart toolbar

Required controls:

```text
1D
5D
1M
3M
YTD
1Y
MAX

Candles + Volume
Compare%
Candles
Line
```

Wrap intentionally.

## C8. Chart rendering

Review/refine:

```text
tick spacing
axis clipping
hover labels
crosshair
candlestick width
volume ratio
chart padding
zoom cursor
pan cursor
viewport indicator
```

No distorted typography.

## C9. Inspector consistency

Symbol and Chart contexts share layout grammar.

Mouse Details stays in a stable relative location.

## C10. Narrow chart context

Clicking chart header is a deliberate context selection:

```text
chart header click
→ Inspector context = Chart
→ narrow shell active surface = Inspector
```

### Live gate

```text
[ ] no overlapping chart labels
[ ] chart works at narrow widths
[ ] toolbar wraps
[ ] symbol selection opens Inspector
[ ] chart-header selection opens Chart Inspector
[ ] compare checkbox does not auto-navigate
```

---

# 8. Pass D — Notifications Makeover

Refine existing system only.

No new notification semantics.

Review:

```text
toast dimensions
severity tint intensity
top border
stacking
narrow placement
bell badge
history layout
filter flyout
```

Responsive:

```text
desktop
→ anchored

constrained
→ wider overlay

narrow
→ full-width below header
```

### Notification gate

```text
[ ] no clipped toast/history surface
[ ] timers remain readable
[ ] persistent Error/Critical remain persistent
[ ] Notification Center usable at narrow width
```

---

# 9. Pass D — Console Makeover

No feature expansion.

Polish:

```text
Overview
Logs
Audit
Diagnostics
```

Use shared table viewport for Logs/Audit.

Standardize:

```text
Objects spacing
selection
filters
Inspector detail formatting
status presentation
empty states
```

### Console gate

```text
[ ] all Console sections reachable in every shell mode
[ ] Logs/Audit tables remain readable
[ ] selection opens Inspector in narrow mode
[ ] diagnostics controls remain available
```

---

# 10. Pass E — Accessibility / Interaction Audit

## Keyboard

Verify:

```text
Tab
Shift+Tab
Enter
Space
Escape
focus visibility
```

## Pointer

Verify cursor semantics.

## Touch

Verify:

```text
critical narrow actions have usable tap targets
nothing important requires hover
```

## Screen-reader labels

Especially:

```text
sort controls
filter controls
bell
notification state
range controls
panel switcher
overlay toggles
```

### Pass E gate

```text
[ ] no keyboard trap
[ ] focus visible
[ ] all major surfaces keyboard reachable
[ ] touch interactions verified
[ ] semantic labels match behavior
```

---

# 11. Pass E — Zoom / Resize Matrix

Representative viewport widths:

```text
1920
1600
1366
1200
1024
900
768
600
480
390
360
```

Representative heights:

```text
1080
900
768
600
480
```

Browser zoom:

```text
80%
100%
125%
150%
```

Text/root scaling:

```text
100%
125%
150%
200% where practical
```

Required dynamic cases:

```text
resize while filter open
resize while Notification Center open
resize while Console selection active
resize while chart Inspector active
resize while table horizontally scrolled
resize across Desktop → Constrained → Narrow → back
```

---

# 12. Pass E — Large-Data Stress

Test representative seeded UI state:

```text
hundreds of Entities
thousands of Logs
thousands of AuditEvents
large Notification history
```

Confirm:

```text
scroll remains responsive
tables remain virtualization-compatible
shell transitions remain stable
selection remains responsive
```

This is frontend performance verification, not research-domain load testing.

---

# 13. Pass F — CSS / Token Cleanup

After behavior is correct, clean the styling system.

Goals:

```text
remove obsolete media-query patch layers
remove one-off spacing fixes
deduplicate control CSS
deduplicate panel CSS
centralize responsive tokens
centralize z-index roles
centralize flyout sizing
centralize table separator tokens
centralize severity visual tokens
```

No visible historical patchwork should remain.

---

# 14. Z-Index Roles

Define semantic layers:

```text
base
sticky
table-sticky
panel-overlay
flyout
notification-toast
notification-center
modal
```

No arbitrary high-number proliferation.

---

# 15. Responsive Mode Thresholds

Do not freeze thresholds before implementation measurement.

Procedure:

```text
1. measure useful minimum widths
2. derive shell pressure thresholds
3. test representative viewports
4. adjust to avoid awkward transition zones
```

The old 76rem/58rem breakpoints are historical evidence, not canonical values.

---

# 16. Frontend Amendment Update

Add the accepted amendment to:

```text
docs/frontend/
FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md
```

Update the main frontend design system to reference the amendment so the old table-priority-hiding guidance is not read in isolation.

---

# 17. Tests to Add

At minimum:

```text
shell mode derivation
panel reachability
overlay open/close
narrow switcher
selection-triggered Inspector transition
chart-header narrow transition
state preservation across mode changes
table viewport behavior
flyout collision handling
notification narrow mode
Console narrow mode
```

Where browser-layout automation is impractical in the existing test stack, add deterministic DOM/state tests plus a documented manual matrix.

---

# 18. Risk Tier

```text
Pass A shell                Tier 2
Pass B primitives           Tier 2
Pass C feature polish       Tier 2
Pass D visual polish        Tier 1/2
Pass E accessibility        Tier 2
Pass F cleanup              Tier 1/2
```

No Tier-3 research review is expected.

---

# 19. Release Rule

`paper_labs_1.3.0.zip` should ship only after all Pass A–F gates are complete.

Do not release a visually partial `1.3.0`.

If user testing after release finds polish defects:

```text
1.3.1
1.3.2
...
```

remain iterations inside the frontend makeover milestone.

---

# 20. Final Acceptance Checklist

```text
[ ] no page-level horizontal overflow

[ ] no dead-end responsive hidden panels

[ ] Desktop mode works

[ ] Constrained overlays work

[ ] Narrow switcher works

[ ] deliberate selection opens Inspector in narrow mode

[ ] Live chart-header selection opens Chart Inspector in narrow mode

[ ] selection/state survives resizing

[ ] Entity table preserves columns through local scroll

[ ] Console tables use the same preservation behavior

[ ] Workspace headers never overlap

[ ] chart text never distorts or overlaps

[ ] flyouts never become stranded/clipped

[ ] Notification Center adapts correctly

[ ] top navigation remains reachable

[ ] Inspector remains readable

[ ] touch targets verified

[ ] keyboard/focus verified

[ ] zoom matrix tested

[ ] large-data stress tested

[ ] CSS patch layers cleaned

[ ] frontend amendment installed/referenced
```

Once all items pass, 1.3 is considered implementation-complete and ready for milestone review.
