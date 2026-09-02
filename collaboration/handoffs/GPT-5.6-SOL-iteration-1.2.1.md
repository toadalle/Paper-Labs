# Paper Lab — Iteration 1.2.1

**Model:** GPT-5.6 Sol  
**Thread:** implementation / responsive layout  
**Status:** iteration complete  
**Project version:** 1.2.1

## RESULT

Corrects dynamic-layout readability regressions found during local testing of 1.2.0. No new product feature is introduced.

## CHANGELOG

### Entities
- `public/styles.css` — preserves the complete seven-column Entity table at its readable minimum width and delegates constrained layouts to a dedicated horizontal/vertical scroll viewport instead of hiding or crushing columns.

### Live chart
- `src/frontend/live/chart.ts` — moves price/time axis text out of the non-uniformly scaled SVG into fixed-size HTML overlay labels so dynamic layouts cannot stretch/distort text.
- `public/styles.css` — adds stable chart-axis overlay typography.

### Version / collaboration
- `package.json`, `package-lock.json`, `src/domain/version.ts`, `README.md` — version 1.2.1.
- `collaboration/manifests/MANIFEST-1.2.1.json` — deterministic archive manifest.

## TESTS
- TypeScript checks
- existing automated suite
- production build
- manifest verification

## DOC/CODE ALIGNMENT NOTES

### ALIGNED
- Frozen frontend rule that analytical tables may scroll internally instead of collapsing their useful information density.
- Dynamic Workspace sizing remains intact; only the table contents gain an independent minimum readable width.
- Live chart remains responsive while axis typography is presentation-stable.

### PENDING
- None introduced by 1.2.1.

### DEVIATIONS
- None.

## RISKS
- None beyond normal visual validation across browser zoom/window sizes.
