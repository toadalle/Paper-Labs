# Paper Lab — Implementation Workflow

## Project-state rule

Git and GitHub are not part of the operating workflow.

Each returned archive is a complete versioned project state:

```text
paper_labs_MAJOR.MILESTONE.ITERATION.zip
```

Project-root files must be directly at ZIP root, with no wrapper directory.

## Model roles

- Web GPT: primary implementation-phase builder/analyst.
- Web Claude: engineering manager/reviewer; may propose spec amendments and may propose rescue implementation.
- Claude web rescue: only after user approval, normally after GPT implementation plus focused repair fails.
- Claude Code: targeted direct-local implementation when materially useful.
- Codex: selective independent audit/specialist for high-risk work.

A rescue implementation never weakens the Risk Tier or its required review.

## Milestone review handoff

Every milestone handoff includes:

```text
RESULT
FILES CHANGED
TESTS
SPEC SECTIONS
DEVIATIONS
RISKS
OPEN QUESTIONS
PROJECT VERSION
CHANGELOG
DOC/CODE ALIGNMENT NOTES
```

`CHANGELOG` groups added/modified/removed files by subsystem and states why each changed.

`DOC/CODE ALIGNMENT NOTES` records the known packaging-time alignment state using:

```text
ALIGNED
PENDING
UNRECORDED DECISION
DEVIATION
```

These notes are a self-reported alignment aid, not independent proof of correctness.

## Manifest-backed consistency sweep

Starting with version 1.0.3, archives retain version manifests at:

```text
collaboration/manifests/MANIFEST-<version>.json
```

Each manifest contains path, SHA-256, and byte size for tracked project files.

Tracked content includes source, tests, docs, collaboration handoffs/reviews, public assets, scripts, package metadata, TypeScript configs, `.env.example`, and README content.

Excluded from manifests:

```text
.env
node_modules/
dist/
dist-tests/
collaboration/manifests/
data/datasets/
data/logs/
data/exports/
data/*.sqlite*
*.zip
```

`collaboration/manifests/` is intentionally excluded so historical manifest bookkeeping does not recursively change every later manifest.

Version 1.0.2 is the one-time full consistency baseline. `MANIFEST-1.0.2.json` is computed from the released 1.0.2 archive and retained beginning in 1.0.3.

For 1.0.3 onward:

1. GPT derives the changed path set from current vs previous manifests.
2. The handoff `CHANGELOG` accounts for that changed path set.
3. Claude may independently recompute actual archive hashes and compare them against the manifest.
4. Manager review is scoped to the manifest diff plus alignment notes unless a full sweep is explicitly warranted.

Manager consistency checks include:

```text
19. Does the changelog account for every source-file change?
20. Does docs/collaboration imply a settled decision not reflected in code, or vice versa?
21. Does the current manifest agree with the stated changelog, including added, modified, and removed files?
```

## Implementation review cadence refinement

During normal implementation:

```text
minor bug / polish / routine iteration
→ user + GPT

new feature or interaction request
→ GPT/Claude design review before implementation when requested by user

milestone completion
→ Claude manager review

architecture/spec/research-validity risk
→ Claude manager review and normal Risk-Tier escalation
```

Claude is not required to review every patch-level iteration. This keeps independent review focused on changes where it provides material value rather than duplicating routine GPT/user iteration.
