# Paper Lab

Paper Lab is an Entity research system with immutable scientific evidence, deterministic Arena evaluation, evolutionary simulation foundations, live market observation, and operator-focused observability.

## Portable Research — 1.6.1


Paper Lab 1.6 adds PLPS v1 portable import codes on top of the executable-research substrate. The same strict JSON specification can create a new Entity/Arena from an Objects-panel Import surface or patch the selected object according to domain rules. READY Entity birth changes become a new DRAFT Variant; used Arena changes become the next immutable Arena version. Multi-object Entity/Arena bundles preview and apply through one domain-graph transaction, with prepared MarketDataSnapshots explicitly outside that rollback boundary.

```text
Paste PLPS JSON
→ server ImportPlan
→ inspect diff / version / variant consequences
→ Apply exact plan
→ ordinary domain services + AuditEvents
```

Schema discovery is available at `/api/import/schema` and `/api/import/schema/:kind` for future LLM/API consumers. PLPS v1 decoding is now a permanent compatibility surface.

### Executable research foundation

Paper Lab can complete its first end-to-end research loop:

```text
Candidate DRAFT
→ configure strategy traits
→ READY immutable Entity
→ versioned Arena + MarketDataSnapshot
→ EvaluationRun
→ Experience + Events + Trace
→ Reward + Hard Gates
```

V1 executable research uses a deterministic Moving Average Cross strategy, long-only target exposure, bounded-history indicators, next-bar-open fills, final-close terminal liquidation, fractional simulated shares, and a buy-and-hold benchmark. The Experience Inspector exposes backend-produced performance, Reward components, hard gates, fills, Trace state, and full research provenance.

Live remains observation-only and separate from scored research. Scored evaluation consumes immutable MarketDataSnapshot artifacts and verifies their stored content hash before execution.

## Frontend shell

- **Research Desktop** — Objects / Workspace / Inspector are visible together.
- **Constrained / Narrow** — a persistent `Objects / Workspace / Inspector` dock makes exactly one major working surface the focus at a time.

Analytical tables preserve readable column geometry and scroll locally. Notification History is a dismissible right-side panel. Live watchlist symbols are explicit browser-local preferences and are never seeded by Paper Lab.

See:

- `docs/architecture/PAPER-LAB-V1-ARCHITECTURE.md`
- `docs/architecture/ARCHITECTURE-AMENDMENT-004-executable-research-contract.md`
- `docs/architecture/ARCHITECTURE-AMENDMENT-005-portable-research-specifications.md`
- `docs/implementation/MILESTONE-1.5.0.md`
- `docs/implementation/MILESTONE-1.5.1.md`
- `docs/implementation/MILESTONE-1.5.2.md`
- `docs/implementation/MILESTONE-1.6.0.md`
- `docs/implementation/MILESTONE-1.6.1.md`
- `docs/decisions/DECISIONS-LOG.md`

## Run

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The real `.env` remains local and must not be included in project ZIPs.
