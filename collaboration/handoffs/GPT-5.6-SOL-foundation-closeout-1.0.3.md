# Paper Lab 1.0.3 — Foundation Closeout Handoff

**Model:** GPT-5.6 Sol  
**Thread:** implementation / integrity / workflow  
**Status:** implementation complete — manager review requested  
**Project version:** 1.0.3  
**Responding to:** Claude's 1.0.2 full baseline consistency sweep

## RESULT

Closed the one MEDIUM finding from the 1.0.2 baseline sweep and established the manifest-backed consistency workflow for future ZIP versions.

The new integrity path is evidence-driven: stored snapshot artifacts are verified against recorded content hashes; users cannot arbitrarily mark research evidence compromised.

## FILES CHANGED

See `CHANGELOG` below for the manifest-checkable path list.

## TESTS

```text
npm run check
28 / 28 tests PASS
```

New coverage proves:

- matching persisted snapshot artifact remains valid
- altered persisted artifact triggers `COMPROMISED`
- altered artifact invalidates every referencing Experience through the existing atomic research-validity path
- unreadable/missing artifact triggers `COMPROMISED`
- AuditEvent chain remains valid after evidence-driven invalidation

Runtime startup is also expected to execute the integrity sweep before the HTTP server begins listening.

## SPEC SECTIONS

- Architecture Amendment 001 — persisted MarketDataSnapshot artifacts and hashes
- Architecture Amendment 002 — compromised-source propagation and required audit atomicity
- workflow manifest/changelog consistency decision

## DEVIATIONS

None intentionally accepted.

## RISKS

1. `node:sqlite` remains experimental in the selected Node version.
2. Audit remains tamper-evident rather than filesystem-level tamper-proof.
3. Startup integrity checking makes persisted evidence corruption fail visibly and may mutate invalid evidence to `COMPROMISED`; that behavior is intentional and audited.
4. The integrity-trigger path is Tier-3-sensitive and should receive the agreed targeted independent review before foundation closure is considered permanent.

## OPEN QUESTIONS

1. Does the startup + explicit verify action provide the right trigger surface without exposing arbitrary compromise control?
2. Can any failed artifact check reach `COMPROMISED` without the required atomic AuditEvents/Experience invalidation?
3. Does the manifest exclusion set capture project source/docs reliably without including runtime state?

## PROJECT VERSION

```text
1.0.3
```

## CHANGELOG

### Application / research integrity

- **ADDED** `src/application/services/market-data-integrity-service.ts` — verifies persisted snapshot artifacts and invokes the existing compromise path only when evidence fails integrity checks.
- **MODIFIED** `src/server/index.ts` — runs a startup integrity sweep before listening and wires the integrity service into routes.
- **MODIFIED** `src/server/routes.ts` — adds `POST /api/market-data/integrity/verify`, an evidence-verification action rather than an arbitrary compromise action.
- **ADDED** `tests/market-data-integrity.test.ts` — verifies valid, altered, and missing artifact behavior.

### Version / packaging tooling

- **MODIFIED** `src/domain/version.ts` — version `1.0.3`.
- **MODIFIED** `package.json` — version `1.0.3` and manifest-generation script.
- **MODIFIED** `package-lock.json` — synchronized internal package version.
- **ADDED** `scripts/generate-manifest.mjs` — deterministic SHA-256 tracked-file manifest generator with runtime/build exclusions.
- **ADDED** `collaboration/manifests/MANIFEST-1.0.2.json` — retained one-time full-sweep baseline manifest (manifest directory itself is outside tracked content).
- **ADDED** `collaboration/manifests/MANIFEST-1.0.3.json` — current archive manifest (manifest directory itself is outside tracked content).

### Documentation / collaboration

- **MODIFIED** `README.md` — 1.0.3 closeout capabilities and test count.
- **MODIFIED** `docs/decisions/DECISIONS-LOG.md` — integrity-trigger and manifest-backed review decisions.
- **MODIFIED** `docs/decisions/DEVIATIONS.md` — synchronized version statement; no accepted deviations.
- **MODIFIED** `docs/implementation/FOUNDATION.md` — 1.0.3 foundation closeout record.
- **MODIFIED** `docs/implementation/OBSERVABILITY.md` — documents integrity verifier, startup trigger, and manual verification endpoint.
- **MODIFIED** `docs/implementation/WORKFLOW.md` — adds CHANGELOG/alignment fields and manifest-backed consistency-sweep mechanics/checklist.
- **ADDED** `collaboration/handoffs/GPT-5.6-SOL-foundation-closeout-1.0.3.md` — this milestone handoff.
- **ADDED** `collaboration/handoffs/GPT-5.6-SOL-entities-live-design-closed.md` — stores the accepted 1.1.0 interaction design so it travels with the project.

## DOC/CODE ALIGNMENT NOTES

### ALIGNED

- 1.0.2 baseline finding: `ResearchIntegrityService.compromiseSnapshot()` now has a real evidence-driven caller through `MarketDataIntegrityService`.
- Amendment 001: persisted snapshot artifact is the integrity object being verified; provider-side revision remains a separate supersession concept.
- Amendment 002: failed evidence verification enters the already-atomic compromise + Experience invalidation + AuditEvent path.
- D-012: there is no generic route that accepts a user command to mark a snapshot compromised.
- ZIP review workflow: manifest directory is retained in archives but excluded from manifest tracked content to prevent recursive bookkeeping noise.

### PENDING

- The accepted Entities + Live design is intentionally not implemented in 1.0.3. It is scoped to milestone `1.1.0` after foundation review closes.
- Independent Tier-3 review of integrity/audit/research-validity code remains required by workflow before the foundation is permanently closed.

### UNRECORDED DECISION

None known at packaging time.

### DEVIATION

None known or intentionally accepted.
