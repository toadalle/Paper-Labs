# Paper Lab — Milestone 1.3.0 Frontend Makeover

**Model:** GPT-5.6 Sol  
**Status:** implementation complete — user test + milestone review requested  
**Project version:** 1.3.0

## RESULT

Implemented the closed 1.3 frontend makeover design. The old CSS-only collapse rules that made Inspector/Objects unreachable are removed. Paper Lab now has explicit Desktop, Constrained, and Narrow shell modes, preserved analytical tables, shared viewport-aware flyout positioning, touch-aware narrow controls, responsive Notification Center behavior, and a formal frontend amendment superseding the old table-hiding default.

## FILES CHANGED

### Responsive shell
- `src/frontend/shell/responsive.ts` — capability-derived shell mode policy.
- `src/frontend/main.ts` — shell state, constrained overlay controls, narrow surface switcher, resize transitions, selection-driven narrow Inspector behavior, keyboard row selection, shared flyout placement.
- `public/styles.css` — responsive shell modes, touch/coarse-pointer sizing, table preservation, narrow header/nav, constrained overlays, notification adaptation, chart/Console responsive rules, semantic z-index roles, CSS cleanup.

### Shared primitives
- `src/frontend/shared/flyout.ts` — viewport-aware anchored flyout positioning.
- `src/frontend/pages/entities.ts` — Entity table uses shared table viewport marker.
- `src/frontend/pages/console.ts` — Console Logs/Audit use shared table viewport marker.

### Tests
- `tests/responsive-shell.test.ts`
- `tests/flyout.test.ts`
- `tests/frontend-makeover.test.ts`

### Canonical docs
- `docs/frontend/FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md`
- `docs/frontend/PAPER-LAB-V1-DESIGN-SYSTEM.md`
- `docs/implementation/MILESTONE-1.3.0.md`
- `docs/implementation/FRONTEND-1.3-VALIDATION.md`
- `docs/decisions/DECISIONS-LOG.md`

### Version/package
- `README.md`
- `package.json`
- `package-lock.json`
- `src/domain/version.ts`

## TESTS

- TypeScript checks: PASS
- Automated tests: 49 / 49 PASS
- Runtime bootstrap/server smoke: PASS
- All SPA routes: PASS
- Static headless-Chromium layout harness: PASS at 1366, 900, 390, and 360px widths
- Page-level horizontal overflow: NONE in tested shell modes
- Local Entity table horizontal scrolling: verified
- Constrained Objects/Inspector reveal states: verified
- Narrow Objects/Workspace/Inspector states: verified
- Coarse-pointer 44px hit targets: verified

- Manifest diff from 1.2.2: 9 added / 10 modified / 0 removed tracked files

## SPEC SECTIONS

Implements `FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md` and the closed 1.3 peer-design agreement.

## DEVIATIONS

None intentionally accepted.

## RISKS

- Real browser/OS zoom, installed font differences, and live Alpaca chart payloads still require user visual testing.
- The current frontend is framework-free and re-renders large sections of DOM. Large-data tests preserve current behavior, but true table virtualization remains a compatibility requirement rather than a new 1.3 feature.

## CHANGELOG

### Shell / responsive
- Replaced dead-end `display:none` breakpoint behavior with Desktop / Constrained / Narrow modes.
- Added explicit constrained Objects/Inspector overlay reveal controls.
- Added narrow persistent `Objects | Workspace | Inspector` switcher.
- Deliberate narrow selections automatically open Inspector; view adjustments do not.
- Narrow app header becomes brand/tools row + horizontally scrollable primary nav row.

### Tables / headers / flyouts
- Tables preserve meaningful columns and scroll locally by default.
- Console Logs/Audit now share the table viewport contract.
- Workspace headers reflow rather than overlap/hide summary controls.
- Shared flyout positioning clamps horizontally and flips vertically when needed.
- Entity/asset/notification filter surfaces cannot be clipped by panel overflow.

### Live / notifications / Console
- Live toolbar/chart sizing adapts to narrow mode without distorted typography.
- Notification Center becomes full-width-bounded under narrow mode.
- Narrow interaction targets become touch-friendlier; coarse-pointer inputs receive the same minimum target floor.
- Console tables and controls use the same responsive system.

### Documentation
- Added Frontend Amendment 001.
- Added D-021 through D-023 decisions.
- Main frontend spec now points to the amendment so the old table/collapse defaults cannot be read as current policy.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED
- All major surfaces remain reachable in every explicit shell mode.
- Table preservation replaces generic priority hiding.
- Live chart-header click is treated as deliberate Inspector selection in Narrow mode.
- Touch/pointer and large-data checks are part of acceptance.

### PENDING / NOT PART OF 1.3
- True runtime table virtualization is not introduced; current tables remain virtualization-compatible by contract.
- No new domain/research features are included.

### UNRECORDED DECISIONS
- None known at packaging time.

### DEVIATIONS
- None known at packaging time.

## FOLLOW-UP

1. User tests 1.3.0 in normal, split-screen, narrow, zoomed, and live-chart scenarios.
2. Routine visual defects become 1.3.x iterations with GPT/user.
3. Once user considers the makeover stable, Claude performs the milestone-level changelog/manifest review.
