# Paper Lab 1.3.1 — Responsive Interaction Corrections

**Model:** GPT-5.6 Sol  
**Baseline:** 1.3.0  
**Status:** implementation correction after user testing

## Why 1.3.1 exists

Real Chrome testing of 1.3.0 exposed four implementation defects inside the approved 1.3 responsive design:

1. Narrow surface controls appeared selectable but clicks were overwritten back to Workspace.
2. The surface switcher occupied an excessive amount of top-of-page space at extreme zoom/narrow widths.
3. Timed notification progress visually restarted whenever the application rerendered, and timer pausing did not cover loss of browser focus.
4. Live still injected an implicit SPY watchlist item even though Live objects are user-selected view state.

These are implementation corrections. They do not reopen the 1.3 frontend design.

## Surface navigation root cause

The shell body and the narrow switcher buttons both used `data-narrow-surface`.

The event wiring selected every element with that attribute, which unintentionally attached the surface-change handler to the shell body as well as the buttons. A button click set the requested surface, then bubbled to the shell body and restored the shell body's prior `WORKSPACE` value.

1.3.1 separates state storage from controls:

```text
shell body
→ data-active-surface

surface buttons
→ data-surface-target
```

Only `.surface-dock-tab[data-surface-target]` receives surface-navigation handlers.

## Surface dock

The large top switcher is replaced with a compact persistent bottom dock:

```text
Objects | Workspace | Inspector
```

### Constrained mode

- dock is centered near the bottom of the viewport;
- Objects opens the left overlay;
- Inspector opens the right overlay;
- Workspace explicitly closes either overlay and returns to the primary Workspace.

### Narrow mode

- dock spans the bottom of the viewport;
- exactly one primary surface is active;
- shell content reserves dock space so content is not hidden behind it.

This retains the accepted persistent-switcher design while removing excessive top chrome.

## Primary navigation

Narrow mode keeps the primary page navigation in the header and horizontally scrollable.

The active page is brought into view after render.

To preserve header space at narrow widths:

- the version suffix is hidden visually;
- Alpaca status is compacted to `Alpaca`, with the complete state retained in accessible label/title text;
- primary navigation remains directly visible rather than moving behind a hamburger menu.

## Notification timers

Each toast retains its own:

```text
remainingMs
startedAt
timeout handle
```

Progress rendering now starts from that notification's current remaining percentage after rerenders instead of visually restarting at 100%.

The toast clock pauses whenever Paper Lab is not active:

```text
document hidden
OR
browser window loses focus
```

On return/focus, each toast resumes from its own remaining active-display time.

Persistent ERROR/CRITICAL behavior is unchanged.

## Live watchlist

Live no longer creates an implicit default SPY object.

A new local preference namespace (`paper-lab.live.v2`) prevents the old implicit default from carrying forward as though it were a user-selected watchlist.

The watchlist therefore starts empty and the user adds symbols through market search.

A direct `/live?symbol=...` URL remains an explicit deep link and may open the requested symbol.

## Validation

- TypeScript client/server/tests: PASS
- automated tests: 52 / 52 PASS
- build: PASS
- runtime bootstrap: PASS
- `/entities` GET SPA route: PASS
- new surface-target regression tests: PASS
- no-default-Live-symbol regression test: PASS
- per-toast active-time source contract test: PASS

Real browser validation remains required for final UX acceptance.
