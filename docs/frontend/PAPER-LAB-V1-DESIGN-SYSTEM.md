# Paper Labs V1 — Frozen Frontend Summary

> **Responsive amendment:** `FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md` supersedes the earlier CSS-only panel-collapse behavior and the generic column-priority-hiding default. Major surfaces must remain reachable at every supported width; analytical tables preserve meaningful columns and scroll locally by default.

## Product feel

Dense professional research instrument. Dark, flat, no gradients, no shadow-based elevation.

## Shell

App Header + Objects + Workspace + Inspector.

Workspace is protected first under pressure. Collapse Inspector, then Objects.

Reference bounds:
- Objects 13.75rem min / ~18vw preferred / 21.25rem max
- Inspector 17.5rem min / ~22vw preferred / 26.25rem max
- Workspace target minimum 35rem

Use continuous sizing and local container adaptation rather than device-label breakpoints.

## Typography

UI: Inter  
Monospace: Cascadia Code, ligatures disabled

## Surfaces

Use semantic tokens:
- bg-app
- bg-panel
- bg-control
- bg-hover
- bg-selected
- bg-overlay

No component-level raw colors outside token definition.

## Entity CRM pattern

Objects:
- search
- lifecycle
- state
- family

Workspace:
dense table, not card-grid toggle.

Initial columns:
- Name
- Family
- Lifecycle
- Recent Reward
- Consistency
- Age
- Last Activity

Inspector order:
- Profile
- Actions
- Performance
- Memory
- Lineage
- Activity

## Flyouts

Right-anchored overlay; cover Inspector first and may extend into Workspace. Never create a fourth shell column. Use ~0.375rem trigger gap.

## Separation

Backend/domain owns business meaning.

Frontend selectors own view meaning.

Shared formatters own presentation only.

Frontend never recomputes Reward, Approval, survival, breedable, promotion eligibility, hard gates, or run state.

## Async and accessibility

Explicit loading/empty/error/ready states.

Keyboard-operable controls, visible focus, Escape where appropriate, row keyboard selection, and color never as the sole state carrier.
