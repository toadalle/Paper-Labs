# Paper Lab 1.0.1 — Startup Hotfix

**Model:** GPT-5.6 Sol  
**Status:** implementation summary  
**Version:** 1.0.1

## RESULT

Windows startup launcher simplified. The custom `scripts/dev.mjs` wrapper was removed.

`npm run dev` now delegates command chaining to npm/the platform shell:

```json
"dev": "npm run build && node --env-file-if-exists=.env dist/server/index.js"
```

This avoids the Windows `spawnSync("npm.cmd", ...)` failure mode that caused 1.0.0 to return silently to PowerShell.

## FILES CHANGED

- `package.json`
- `package-lock.json`
- `README.md`
- removed `scripts/dev.mjs`
- added this handoff

## TESTS

Run:

```text
npm ci
npm run check
npm run dev
```

The application should build and then remain running with the server listening.

## SPEC SECTIONS

No frozen architecture behavior changed.

## DEVIATIONS

None.

## RISKS

This is intentionally a Tier 1 startup-only hotfix. Logger/Audit/research-validity corrections are not included here and are planned for 1.0.2 after Architecture Amendment 002 review.

## FOLLOW-UP

1. Confirm startup on Windows.
2. Settle Architecture Amendment 002.
3. Implement logger/audit/research-validity foundation as `paper_labs_1.0.2.zip`.
