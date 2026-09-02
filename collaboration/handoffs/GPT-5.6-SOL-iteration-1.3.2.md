# Paper Lab — Iteration 1.3.2

**Model:** GPT-5.6 Sol  
**Thread:** frontend / responsive shell / Live  
**Status:** implementation handoff  
**Version:** `1.3.2`

## RESULT

Corrected two regressions found during real 1.3.1 testing:

1. When the responsive surface selector is present, it now gives `Objects`, `Workspace`, or `Inspector` the full working area rather than sharing the view with constrained overlays.
2. Live watchlist/search behavior is hardened so full-page navigation preserves tracked symbols and search typing is not interrupted by whole-app rerenders.

## CHANGELOG

### Responsive shell

**MODIFIED `src/frontend/main.ts`**
- the surface dock now owns one active surface for every non-desktop shell mode
- constrained mode no longer tracks an overlay as the visible surface
- deliberate selections open Inspector in both constrained and narrow focus modes
- page navigation resets non-desktop focus to Workspace without mixing surfaces

**MODIFIED `src/frontend/shell/responsive.ts`**
- non-desktop focus modes now share the deliberate-selection → Inspector rule

**MODIFIED `public/styles.css`**
- constrained mode no longer uses side overlays
- Objects / Workspace / Inspector are mutually exclusive full-focus surfaces when the dock is present
- fixed dock remains available without overlapping a second major surface

### Live

**MODIFIED `src/frontend/main.ts`**
- asset-search keystrokes no longer rerender the entire application
- async asset-search results restore focus only after result rendering
- Live preferences are persisted during initial bootstrap normalization
- Live preferences are persisted on `pagehide` before full-page navigation/reload

### Documentation

**MODIFIED `docs/frontend/FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md`**
- records the user-directed replacement of constrained overlays with a full-focus surface selector

### Tests

**MODIFIED `tests/responsive-shell.test.ts`**
- constrained and narrow selection behavior now matches the focused-surface model

**MODIFIED `tests/frontend-makeover.test.ts`**
- regression coverage for constrained full-focus surfaces
- regression coverage for Live search typing without per-keystroke rerender
- regression coverage for Live preference persistence across full-page navigation

## TESTS

```text
TypeScript checks: PASS
Automated tests: 55 / 55 PASS
Build: PASS
```

## SPEC SECTIONS

- Frontend Amendment 001 — responsive shell
- Live workspace — provider-backed symbol browser
- local UI preference state

## DEVIATIONS

None. The amendment itself was updated to reflect the user's explicit post-1.3.1 shell preference.

## RISKS

- Live watchlist remains local UI preference state, not audited domain state.
- Browser-local preferences depend on the same origin (`127.0.0.1:3000`) as designed.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- When the responsive surface dock is visible, it is now the single owner of the major working surface.
- Deliberate selection opens Inspector in non-desktop focus modes.
- Live begins without an implicit market symbol and user-added symbols remain preferences.

### PENDING

- Real Chrome verification of full-page `/` → `/live` persistence and symbol-search typing.

## FOLLOW-UP

User should specifically test:

```text
1. Add several Live symbols.
2. Navigate to http://127.0.0.1:3000/ using a full page load.
3. Return to Live and verify the watchlist is intact.
4. Type continuously in Live asset search.
5. At constrained width, switch Objects / Workspace / Inspector and verify only the selected major surface occupies the working area.
```
