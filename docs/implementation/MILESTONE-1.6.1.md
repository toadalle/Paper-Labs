# Paper Lab — Iteration 1.6.1: Arena Authoring Focus + Experience Result Export

## Purpose

1.6.1 removes the permanently-visible Arena creation form from the ordinary Arenas & Experiences workspace and adds a complete read-only export path for Experience scientific evidence.

## Arena authoring

Arena Objects now presents:

```text
[ Import ] [ + ]
```

`+` switches Workspace into a focused Create Arena editor. The ordinary Arena/Experience tables are not rendered underneath the authoring surface. `Cancel` exits without mutation. Successful `Capture Snapshot & Create` exits create mode, selects the created Arena, and returns to the ordinary research-results workspace.

This preserves the distinction:

```text
Objects actions
→ start a task

Workspace
→ owns the active task or normal research browsing
```

## Experience export

A selected completed Experience exposes `Export Results` in Inspector Actions after its immutable detail has loaded.

The generated JSON envelope is:

```json
{
  "format": "paper-lab-experience-result",
  "version": 1,
  "product": { "name": "Paper Lab", "version": "1.6.1" },
  "exportedAt": "...",
  "experience": {},
  "events": [],
  "trace": {}
}
```

The payload contains backend-produced scientific evidence without recalculating Reward, gates, fills, or Trace data in the frontend.

This artifact is deliberately **not PLPS**. PLPS represents portable configuration and mutation intent; Experience result export represents immutable scientific evidence for analysis, sharing, or external inspection. It cannot be pasted into Import to fabricate historical research.

## Scientific behavior

No execution-engine or indicator-library behavior changed.

```text
EXECUTION_ENGINE_VERSION   1.0.0
INDICATOR_LIBRARY_VERSION  1.0.0
```
