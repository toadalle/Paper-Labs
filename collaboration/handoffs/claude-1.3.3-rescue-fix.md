# Paper Lab 1.3.3 — Claude Rescue Fix

**Model:** Claude (Sonnet 5)
**Thread:** implementation
**Status:** rescue fix complete — returning to GPT as primary builder
**Baseline:** `paper_labs_1.3.2.zip` (user-reported failure, terminal logs supplied)
**Rescue authorization:** user, directly — "chatgpt has failed several iterations to get this a functioning system so ill pass this next version for you to fix it"

---

## Rescue Scope

Per Workflow §7/§9, this is bound by the Risk Tier of the code touched: `src/frontend/main.ts` is Tier 1/2 (interaction/UI), not Tier 3 — no persistence, domain, or research-validity code was touched. Deep Codex review is not required for this fix, but GPT should still read this diff before resuming as primary builder, per §7's "ownership returns to GPT" structured-summary rule.

## RESULT

Two real bugs found and fixed from the terminal log evidence and source read. One structural limitation identified and explicitly **not** fixed in this pass — flagged as a follow-up rather than patched around, since a proper fix needs a design decision, not a rescue-scope patch.

## Root Cause 1 (the actual reported "Live view breaks the whole page" bug)

**An infinite render/focus/fetch loop in the Live asset search.** Confirmed directly from the supplied terminal log: `GET /api/market/assets` fires continuously, often <20ms apart, for minutes straight, until the user pressed Escape.

The loop:
1. User focuses the search input → `state.liveSearchOpen = true`, search scheduled.
2. `searchAssets()` resolves → calls `render()` (full `app.innerHTML` replace — this destroys and recreates the `<input>` node) → since `state.liveSearchOpen` is true, it then calls `.focus()` on the **new** input node to preserve the user's typing position.
3. That programmatic `.focus()` on a freshly-created DOM node dispatches a genuine `focus` event.
4. The `focus` handler unconditionally called `scheduleAssetSearch(0)` — even when `state.liveSearchOpen` was already `true` — scheduling another search with **zero delay**.
5. That search resolves → `render()` again → `.focus()` again → back to step 3. Infinite loop, bounded only by network/render latency.

This fully explains every symptom reported: text selection breaking (the node under the user's cursor keeps getting destroyed and replaced), the chart and other tabs feeling unresponsive (main thread saturated by the loop, click targets shifting under the pointer), and Escape being the only way out (it directly sets `liveSearchOpen = false`, so the next loop iteration's `if (state.liveSearchOpen)` guard in `searchAssets()`'s `finally` block stops the refocus/reschedule chain).

**Fix:** `scheduleAssetSearch(0)` moved inside the `if (!state.liveSearchOpen)` block in the focus handler (`src/frontend/main.ts`), so a fresh search is only triggered on the genuine closed→open transition, not on every re-focus caused by the app's own render cycle.

## Root Cause 2 (partial explanation of the notification symptom)

**Toast overflow silently dropped notifications without clearing their timers.** `state.toasts = [...state.toasts, toast].slice(-5)` kept only the 5 most recent toasts, but any toast pushed out of that window kept its `setTimeout` running in `toastTimers`, firing `dismissToast` later for an id no longer in `state.toasts`. Under rapid-fire Entity creation, this meant older success banners could be silently dropped without ever showing, and their orphaned timers kept firing pointlessly.

**Fix:** before slicing, the toasts being pushed out are identified and their timers explicitly cleared via `clearTimeout`/`toastTimers.delete`. The 5-toast cap itself is unchanged — that's the intentional "maximum visible stack" from the frontend-makeover design, not a bug.

## Known Limitation — Not Fixed, Flagged for GPT

**The toast progress-bar "stutter" is a structural consequence of the full-DOM-re-render architecture, not a logic bug, and wasn't fixed in this pass.** Every `render()` call — for *any* state change anywhere in the app, not just toast-related ones — replaces `app.innerHTML` wholesale, which destroys and recreates every toast's progress-bar `<span>` and its inline CSS animation. The animation therefore visually restarts on every unrelated render (e.g., while spamming Entity creation, which triggers many renders for reasons that have nothing to do with the toasts). The actual dismissal timing is correct — it's driven by `performance.now()`-based elapsed time in `setTimeout`, independent of render churn — so toasts still disappear at the right real time. Only the visual shrink animation is affected.

Fixing this properly needs one of: a persistent (non-recreated) DOM layer for toasts outside the full-rerender tree, or driving the visual bar via a JS interval/`requestAnimationFrame` against a stable element rather than a CSS keyframe restarted by DOM insertion. Both are reasonable but are architecture decisions, not a rescue-scope patch — recommend GPT pick one deliberately in a future pass rather than it being improvised here.

## FILES CHANGED

```
src/frontend/main.ts       — two targeted fixes, described above
src/domain/version.ts      — PRODUCT_VERSION bumped to 1.3.3
package.json               — version bumped to 1.3.3
collaboration/manifests/MANIFEST-1.3.3.json — generated via scripts/generate-manifest.mjs
```

## TESTS

**Could not run `npm ci` / `npm test` / `npm run check` in this environment — no network access to the npm registry (sandbox restriction, not a project issue).** Both fixes were verified by manual code review only: the control flow was traced by hand against the exact log evidence, and the edits were checked for TypeScript syntax consistency with the surrounding code, but **not compiled or executed**. This is a real gap — please run `npm run check` locally before treating this as fully verified, and I'd treat this version as provisional until that happens.

No automated regression test was added for the infinite-loop bug. The existing test suite (`live-query.test.ts`, `chart-interaction.test.ts`) covers pure application-layer logic only — there's no DOM-simulation harness (e.g., jsdom) for `main.ts`'s event-wiring code, and adding one is a bigger investment than this rescue's scope. Worth considering as a real follow-up: this exact bug shape (a render loop triggered by programmatic focus interacting with a render-triggered event handler) is easy to reintroduce elsewhere in this codebase given the full-re-render architecture, and nothing currently catches it automatically.

## SPEC SECTIONS

None — this is a pure implementation bug fix, not a spec-level decision. Both fixes are consistent with existing behavior/intent (debounced search-as-you-type, capped toast stack); nothing here changes documented behavior.

## DEVIATIONS

None logged. No architecture, frontend spec, or amendment content was touched or needed changing.

## RISKS

- **Unverified compilation/test run** (see TESTS above) — the single biggest risk in this handoff. Treat as provisional.
- The toast progress-bar stutter remains unresolved — cosmetic only, not a functional risk, but worth scheduling.
- No regression test exists for either fixed bug — a future refactor of the render/focus wiring could silently reintroduce either issue.

## COMMIT

Not committed — no git repository access in this environment. Files are staged in the delivered `paper_labs_1.3.3.zip`; GPT/user should commit locally after running `npm run check`.

## FOLLOW-UP

1. Run `npm ci && npm run check` locally to confirm the fix compiles and the existing suite still passes before treating 1.3.3 as verified.
2. Decide deliberately how to fix the toast progress-bar stutter (persistent DOM layer vs. JS-driven animation) — don't let it get patched around ad hoc.
3. Consider whether `main.ts`'s full-re-render pattern needs a lighter-weight regression-testing strategy given it's now large enough to have hidden a genuine infinite-loop bug through multiple GPT iterations.

---

Per the rescue rules, ownership returns to GPT now that this specific task is resolved — GPT resumes as primary builder for `1.3.4`/next milestone.
