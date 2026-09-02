# Paper Lab 1.3.4 — Notification Burst/Timer Correction

**Model:** GPT-5.6 Sol
**Thread:** implementation
**Status:** iteration complete
**Baseline:** `paper_labs_1.3.3.zip`
**Responding to:** `collaboration/handoffs/claude-1.3.3-rescue-fix.md`

## RESULT

Reviewed Claude's 1.3.3 rescue fix and resolved the remaining structural toast limitation.

### Root cause

The visible toast stack was not a queue. It truncated to the newest five cards, so burst notifications were discarded from the live presentation layer.

Separately, toast progress bars lived inside `app.innerHTML`, while every application state update replaced the entire app DOM. This recreated each CSS countdown animation on unrelated renders and made progress appear to reset/stutter under burst activity.

### 1.3.4 behavior

- Maximum simultaneous visible toast cards remains 5 to avoid covering the application.
- Overflow is queued rather than discarded.
- Queued timed notifications receive their full duration only when promoted into the visible stack.
- A `+N queued` indicator makes burst backlog explicit.
- Toast DOM is hosted in a persistent `#notification-toast-host` outside the full application rerender tree.
- Toast cards are keyed and retained instead of recreated by normal app renders.
- Progress width is driven by `requestAnimationFrame` from each toast's own remaining active time.
- Hidden/unfocused application pause behavior remains intact.
- Persistence IDs are separate from stable client toast keys, so asynchronous notification persistence cannot disturb active timers.
- Manual/automatic dismissal promotes queued notifications immediately.

## FILES CHANGED

- `src/frontend/main.ts` — persistent toast host, queue, independent client keys, JS-driven progress rendering.
- `public/styles.css` — removes restart-prone CSS countdown animation; adds queue indicator.
- `tests/frontend-makeover.test.ts` — regression checks for persistent host / queue / non-discard behavior.
- `docs/decisions/DECISIONS-LOG.md` — aligns responsive-shell decision and records burst notification semantics.
- `docs/frontend/FRONTEND-AMENDMENT-001-responsive-shell-and-table-preservation.md` — removes stale constrained-overlay acceptance text.
- `docs/implementation/FRONTEND-1.3.4-NOTIFICATION-QUEUE.md` — implementation note.
- `package.json`, `package-lock.json`, `src/domain/version.ts` — version 1.3.4.

## TESTS

`npm run check`:

```text
56 / 56 PASS
```

Additional:

```text
npm run build                PASS
runtime server startup       PASS
/api/bootstrap version       1.3.4
```

## SPEC SECTIONS

Consistent with:
- D-020 Notifications and Console
- Frontend Makeover 1.3 notification polish requirements

## DEVIATIONS

None.

## RISKS

The current frontend still uses a broad full-app string render for most application surfaces. Toasts are now intentionally isolated from that render tree because they have independent temporal state.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- Notification history remains durable and separate from AuditEvent.
- Five is a presentation concurrency limit only; no notification is dropped from the burst queue.
- Notification durations represent visible active-display time.
- Responsive shell decision log now matches the current full-focus surface-selector behavior.

### PENDING

None known for this correction.

## FOLLOW-UP

User should burst-test Entity Quick Create and verify:
1. first five notifications display,
2. backlog count appears,
3. expired/dismissed cards promote queued cards,
4. each promoted card receives a fresh full-duration countdown,
5. progress bars do not jump/reset while Entity creation continues.
