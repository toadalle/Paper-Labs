# GPT-5.6 Sol — Paper Lab 1.6.1 Handoff

**Target archive:** `paper_labs_1.6.1.zip`

## Changes

- Arena creation is no longer a permanent workspace card.
- Arena Objects now exposes `Import` followed by the familiar `+` quick action.
- `+` switches Workspace into focused Arena authoring with an explicit Cancel action.
- Successful Arena creation exits authoring mode, selects the new Arena, and returns to normal Arenas/Experiences browsing.
- Selecting an Arena/Experience while authoring also exits create mode.
- Completed Experience Inspector now exposes `Export Results`.
- Export is a read-only `paper-lab-experience-result` v1 JSON envelope containing the immutable Experience, all ExperienceEvents, and ExperienceTrace.
- Experience export is intentionally distinct from PLPS and cannot mutate/import research history.

## Risk

Tier 2 UI/read-only export follow-up. No scientific execution formulas, Engine version, Indicator Library version, PLPS apply semantics, or persistence invariants changed.
