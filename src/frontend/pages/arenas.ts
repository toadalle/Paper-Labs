import type { Arena, Entity, EvaluationRun, Experience, ExperienceEvent, ExperienceTrace } from '../../domain/types.js';
import { ARENA_CREATE_DEFAULTS } from '../../domain/create-defaults.js';
import type { ExperienceDetailView } from '../types.js';
import { escapeHtml } from '../shared/escape.js';
import { formatNumber } from '../shared/format.js';

export interface ArenasPageInput {
  arenas: Arena[];
  experiences: Experience[];
  evaluationRuns: EvaluationRun[];
  selectedArenaId: string | null;
  selectedExperienceId: string | null;
  experienceDetail: ExperienceDetailView | null;
  experienceLoading: boolean;
  entities: Entity[];
  createMode: boolean;
}

export function renderArenasPage(input: ArenasPageInput): { objects: string; workspace: string; inspector: string } {
  const selectedArena = input.arenas.find(arena => arena.id === input.selectedArenaId) ?? null;
  const selectedExperience = input.experiences.find(experience => experience.id === input.selectedExperienceId) ?? null;
  return {
    objects: objects(input, selectedArena, selectedExperience),
    workspace: workspace(input),
    inspector: selectedExperience
      ? experienceInspector(selectedExperience, input.experienceDetail, input.experienceLoading)
      : selectedArena
        ? arenaInspector(selectedArena, input.entities)
        : emptyInspector()
  };
}

function objects(input: ArenasPageInput, selectedArena: Arena | null, selectedExperience: Experience | null): string {
  const recentArenas = input.arenas.slice(0, 8);
  const recentExperiences = input.experiences.slice(0, 8);
  return `
    <div class="panel-heading"><div><div class="eyebrow">Objects</div><h2>Research</h2></div><div class="panel-heading-actions"><button id="import-arena-objects" class="button" data-portable-import-toggle type="button">Import</button><button id="new-arena" class="icon-button plus-button" type="button" aria-label="Create Arena"><span aria-hidden="true">+</span></button></div></div>
    <div class="objects-summary objects-summary-top"><span>${input.arenas.length} arenas</span><span>${input.experiences.length} experiences</span></div>
    <section class="object-section"><div class="object-section-title">Arenas</div><div class="object-list">
      ${recentArenas.length ? recentArenas.map(arena => `<div class="object-row ${selectedArena?.id === arena.id && !selectedExperience ? 'selected' : ''}" data-arena-object-id="${escapeHtml(arena.id)}" tabindex="0"><div class="object-row-copy"><strong>${escapeHtml(arena.name)}</strong><span>${escapeHtml(arena.symbolUniverse[0] ?? '—')} · v${arena.version}</span></div></div>`).join('') : '<div class="object-section-empty">No Arenas yet.</div>'}
    </div></section>
    <section class="object-section"><div class="object-section-title">Experiences</div><div class="object-list">
      ${recentExperiences.length ? recentExperiences.map(experience => `<div class="object-row ${selectedExperience?.id === experience.id ? 'selected' : ''}" data-experience-object-id="${escapeHtml(experience.id)}" tabindex="0"><div class="object-row-copy"><strong>${escapeHtml(shortId(experience.id))}</strong><span>${escapeHtml(experience.status)} · ${formatSigned(experience.reward)}</span></div></div>`).join('') : '<div class="object-section-empty">No completed Experiences.</div>'}
    </div></section>`;
}

function workspace(input: ArenasPageInput): string {
  if (input.createMode) return arenaCreateWorkspace(input);
  return `<div class="workspace-header"><div><div class="eyebrow">Executable research</div><h1>Arenas & Experiences</h1></div><div class="workspace-actions"><span class="metric">${input.evaluationRuns.filter(run => run.status === 'RUNNING').length} running</span><span class="metric">${input.experiences.length} results</span></div></div>
    <section class="workspace-section">
      <div class="research-section-heading"><div><div class="eyebrow">Immutable environments</div><h2>Arenas</h2></div><span>${input.arenas.length} versions</span></div>
      <div class="table-wrap table-viewport" data-table-viewport="arenas">${input.arenas.length ? arenaTable(input.arenas, input.selectedArenaId, input.selectedExperienceId) : '<div class="empty-state"><strong>No Arenas yet.</strong><span>Use + beside Import to create an Arena, or Import a portable Arena specification.</span></div>'}</div>
    </section>
    <section class="workspace-section">
      <div class="research-section-heading"><div><div class="eyebrow">Immutable scientific results</div><h2>Experiences</h2></div><span>${input.experiences.length} completed</span></div>
      <div class="table-wrap table-viewport" data-table-viewport="experiences">${input.experiences.length ? experienceTable(input.experiences, input.selectedExperienceId) : '<div class="empty-state"><strong>No Experiences yet.</strong><span>Finalize a Candidate, select an Arena, then Run Evaluation from either Inspector.</span></div>'}</div>
    </section>`;
}

function arenaCreateWorkspace(input: ArenasPageInput): string {
  return `<div class="workspace-header"><div><div class="eyebrow">Executable research</div><h1>Create Arena</h1><div class="subtitle">Define a new immutable evaluation environment.</div></div><div class="workspace-actions"><button id="arena-create-cancel" class="button" type="button">Cancel</button></div></div>
    <section class="research-config-card arena-create-focus-card">
      <div class="research-section-heading"><div><div class="eyebrow">New evaluation environment</div><h2>Arena Definition</h2></div><span class="status-chip">long-only · next-bar open</span></div>
      <form id="arena-create-form" class="arena-create-grid">
        <label><span>Version Of</span><select id="arena-base-version" class="control"><option value="">New Arena family</option>${input.arenas.map(arena => `<option value="${escapeHtml(arena.id)}">${escapeHtml(arena.name)} · v${arena.version}</option>`).join('')}</select></label>
        <label><span>Name</span><input id="arena-name" class="control" required placeholder="Arena name"></label>
        <label><span>Symbol</span><input id="arena-symbol" class="control mono" required placeholder="SPY" maxlength="12"></label>
        <label><span>Timeframe</span><select id="arena-timeframe" class="control" required><option value="${ARENA_CREATE_DEFAULTS.timeframe}">1 Day</option></select></label>
        <label><span>Start</span><input id="arena-start" class="control" type="date" required></label>
        <label><span>End</span><input id="arena-end" class="control" type="date" required></label>
        <label><span>Initial Capital</span><input id="arena-capital" class="control" type="number" min="0.01" step="0.01" placeholder="Default ${ARENA_CREATE_DEFAULTS.initialCapital}"></label>
        <label><span>Warmup Bars</span><input id="arena-warmup" class="control" type="number" min="0" max="1000" step="1" placeholder="Default ${ARENA_CREATE_DEFAULTS.warmupBars}"></label>
        <label><span>Commission / Fill</span><input id="arena-commission" class="control" type="number" min="0" step="0.01" placeholder="Default ${ARENA_CREATE_DEFAULTS.commissionPerTrade}"></label>
        <label><span>Slippage (bps)</span><input id="arena-slippage" class="control" type="number" min="0" step="0.1" placeholder="Default ${ARENA_CREATE_DEFAULTS.slippageBps}"></label>
        <label><span>Reward λ</span><input id="arena-reward-lambda" class="control" type="number" min="0" step="0.05" placeholder="Default ${ARENA_CREATE_DEFAULTS.rewardLambda}"></label>
        <label><span>Max Drawdown Gate</span><input id="arena-max-dd" class="control" type="number" min="0" max="1" step="0.01" placeholder="Default ${ARENA_CREATE_DEFAULTS.maxDrawdownGate}"></label>
        <label><span>Minimum Strategy Fills</span><input id="arena-min-trades" class="control" type="number" min="0" step="1" placeholder="Default ${ARENA_CREATE_DEFAULTS.minimumTradeCount}"></label>
        <button class="button primary arena-create-submit" type="submit">Capture Snapshot & Create</button>
      </form>
      <div class="placeholder compact">Name, Symbol, Timeframe, Start, and End are explicit. Optional policy fields may be left blank to use the shown server defaults. Choose Version Of to create the next immutable version in an existing Arena family. Arena.start is the first fully-informed evaluated decision bar; snapshot capture extends backward for warmup and evaluated fills use next-bar open.</div>
    </section>`;
}

function arenaTable(arenas: Arena[], selectedArenaId: string | null, selectedExperienceId: string | null): string {
  return `<table class="entity-table"><thead><tr><th>Name</th><th>Version</th><th>Symbol</th><th>Window</th><th>Capital</th><th>Warmup</th><th>Snapshot</th></tr></thead><tbody>${arenas.map(arena => `<tr data-arena-id="${escapeHtml(arena.id)}" class="${arena.id === selectedArenaId && !selectedExperienceId ? 'selected' : ''}" tabindex="0"><td><strong>${escapeHtml(arena.name)}</strong><small>${escapeHtml(arena.id)}</small></td><td class="mono">v${arena.version}</td><td class="mono">${escapeHtml(arena.symbolUniverse[0] ?? '—')}</td><td class="mono">${escapeHtml(arena.timeWindow.start.slice(0,10))} → ${escapeHtml(arena.timeWindow.end.slice(0,10))}</td><td class="mono">${money(arena.initialCapital)}</td><td class="mono">${arena.warmupBars}</td><td class="mono">${escapeHtml(shortId(arena.marketDataSnapshotIds[0] ?? '—'))}</td></tr>`).join('')}</tbody></table>`;
}

function experienceTable(experiences: Experience[], selectedId: string | null): string {
  return `<table class="entity-table"><thead><tr><th>Experience</th><th>Entity</th><th>Arena</th><th>Return</th><th>Benchmark</th><th>Drawdown</th><th>Reward</th><th>Gates</th></tr></thead><tbody>${experiences.map(experience => `<tr data-experience-id="${escapeHtml(experience.id)}" class="${experience.id === selectedId ? 'selected' : ''}" tabindex="0"><td><strong>${escapeHtml(shortId(experience.id))}</strong><small>${escapeHtml(experience.completedAt?.slice(0,19) ?? '—')}</small></td><td class="mono">${escapeHtml(shortId(experience.entityId))}</td><td class="mono">${escapeHtml(shortId(experience.arenaVersionId))}</td><td class="mono">${pct(experience.totalReturn)}</td><td class="mono">${pct(experience.benchmarkReturn)}</td><td class="mono">${pct(experience.maxDrawdown)}</td><td class="mono">${formatSigned(experience.reward)}</td><td><span class="status-chip ${experience.hardGatePassed ? 'config-ready' : 'config-draft'}">${experience.hardGatePassed ? 'PASS' : 'FAIL'}</span></td></tr>`).join('')}</tbody></table>`;
}

function arenaInspector(arena: Arena, entities: Entity[]): string {
  const readyEntities = entities.filter(entity => entity.lifecycleState === 'CANDIDATE' && entity.candidateStatus === 'ACTIVE' && entity.configurationStatus === 'READY');
  const runControls = readyEntities.length
    ? `<label class="inspector-edit-field"><span>Ready Entity</span><select id="arena-evaluate-entity" class="control">${readyEntities.map(entity => `<option value="${escapeHtml(entity.id)}">${escapeHtml(entity.name)}</option>`).join('')}</select></label><div class="action-grid"><button id="arena-run-evaluation" class="button primary" type="button" data-arena-run-id="${escapeHtml(arena.id)}">Run Evaluation</button></div>`
    : `<div class="placeholder compact">Finalize a Candidate to READY before running this Arena.</div>`;
  return `<div class="inspector-section profile"><div class="eyebrow">Arena Inspector</div><h2>${escapeHtml(arena.name)}</h2><div class="subtitle mono">${escapeHtml(arena.id)} · v${arena.version}</div></div>
    <div class="inspector-section"><h3>Definition</h3>${field('Family root', arena.rootArenaId)}${field('Symbol', arena.symbolUniverse[0] ?? '—')}${field('Timeframe', arena.timeframe)}${field('Start', arena.timeWindow.start)}${field('End', arena.timeWindow.end)}${field('Initial capital', money(arena.initialCapital))}${field('Warmup bars', String(arena.warmupBars))}</div>
    <div class="inspector-section"><h3>Actions</h3><div class="action-grid"><button id="arena-import-selected" class="button" data-portable-import-toggle type="button">Import Code</button></div>${runControls}</div>
    <div class="inspector-section"><h3>Research Provenance</h3>${field('Snapshot', arena.marketDataSnapshotIds[0] ?? '—')}${field('Execution policy', arena.executionPolicyId)}${field('Reward policy', arena.rewardPolicyId)}</div>
    <div class="inspector-section"><h3>Execution</h3>${field('Fill timing', 'Next bar open')}${field('Terminal liquidation', 'Final evaluated close')}${field('Commission/trade', String(arena.executionCostModel.commissionPerTrade))}${field('Slippage', `${arena.executionCostModel.slippageBps} bps`)}</div>`;
}

function experienceInspector(experience: Experience, detail: ExperienceDetailView | null, loading: boolean): string {
  if (loading && !detail) return `<div class="inspector-section profile"><div class="eyebrow">Experience Inspector</div><h2>${escapeHtml(shortId(experience.id))}</h2><div class="placeholder">Loading immutable evidence…</div></div>`;
  const events = detail?.events ?? [];
  const trace = detail?.trace ?? null;
  const fills = events.filter(event => event.eventType === 'FILL_EXECUTED' || event.eventType === 'FORCED_LIQUIDATION');
  const gates = experience.hardGateResults ?? [];
  return `<div class="inspector-section profile"><div class="eyebrow">Experience Inspector</div><h2>${escapeHtml(shortId(experience.id))}</h2><div class="subtitle mono">${escapeHtml(experience.id)}</div></div>
    <div class="inspector-section"><h3>Actions</h3><div class="action-grid"><button id="experience-export-results" class="button" type="button" ${detail ? '' : 'disabled'}>Export Results</button></div><div class="placeholder compact">Exports immutable scientific evidence as a read-only JSON result artifact. It is not a PLPS import code.</div></div>
    <div class="inspector-section"><h3>Summary</h3>${field('Status', experience.status)}${field('Starting capital', money(experience.startingCapital))}${field('Ending equity', money(experience.endingEquity))}${field('Total return', pct(experience.totalReturn))}${field('Benchmark', pct(experience.benchmarkReturn))}${field('Excess return', pct(experience.excessReturn))}${field('Max drawdown', pct(experience.maxDrawdown))}${field('Trades', String(experience.tradeCount ?? 0))}</div>
    <div class="inspector-section"><h3>Reward</h3><div class="research-score ${Number(experience.reward ?? 0) >= 0 ? 'positive' : 'negative'}">${formatSigned(experience.reward)}</div>${rewardBreakdown(experience)}${field('Hard gates', experience.hardGatePassed ? 'PASS' : 'FAIL')}</div>
    <div class="inspector-section"><h3>Hard Gates</h3>${gates.length ? gates.map(gate => `<div class="gate-row ${gate.passed ? 'passed' : 'failed'}"><span>${escapeHtml(gate.gate)}</span><strong>${gate.passed ? 'PASS' : 'FAIL'}</strong><small>${escapeHtml(String(gate.observedValue ?? '—'))} / ${escapeHtml(String(gate.limit ?? '—'))}</small>${gate.reason ? `<small>${escapeHtml(gate.reason)}</small>` : ''}</div>`).join('') : '<div class="placeholder compact">No gate detail stored.</div>'}</div>
    <div class="inspector-section"><h3>Fills</h3>${fills.length ? fillTable(fills) : '<div class="placeholder compact">No fills. A zero-trade Experience remains a valid scientific result if execution completed.</div>'}</div>
    <div class="inspector-section"><h3>Trace</h3>${traceSummary(trace)}${traceTable(trace)}</div>
    <div class="inspector-section"><h3>Strategy</h3>${field('Type', experience.strategyType ?? '—')}${field('Version', experience.strategyVersion ? `v${experience.strategyVersion}` : '—')}${Object.entries(experience.strategyTraits ?? {}).map(([key, value]) => field(key, String(value))).join('')}${field('Trait hash', experience.traitHash ?? '—')}</div>
    <div class="inspector-section"><h3>Provenance</h3>${field('Arena version', experience.arenaVersion ? `v${experience.arenaVersion}` : '—')}${field('Snapshot', experience.marketDataSnapshotIds[0] ?? '—')}${field('Snapshot hash', experience.marketDataContentHashes?.[0] ?? '—')}${field('Execution policy', `${experience.executionPolicyId ?? '—'} · v${experience.executionPolicyVersion ?? '—'}`)}${field('Reward policy', `${experience.rewardPolicyId ?? '—'} · v${experience.rewardPolicyVersion ?? '—'}`)}${field('Execution engine', experience.executionEngineVersion ?? '—')}${field('Indicator library', experience.indicatorLibraryVersion ?? '—')}${field('Research validity', experience.researchValidity)}</div>`;
}

function fillTable(events: ExperienceEvent[]): string {
  return `<div class="inspector-table-viewport"><table class="inspector-data-table"><thead><tr><th>Time</th><th>Effect</th><th>Qty</th><th>Reference</th><th>Execution</th><th>Fee</th><th>Exposure</th></tr></thead><tbody>${events.map(event => `<tr><td class="mono">${escapeHtml(event.timestamp.slice(0,19))}</td><td>${escapeHtml(String(event.payload.effect ?? '—'))}</td><td class="mono">${escapeHtml(formatPayloadNumber(event.payload.quantityDelta, 4))}</td><td class="mono">${escapeHtml(formatPayloadNumber(event.payload.referencePrice, 4))}</td><td class="mono">${escapeHtml(formatPayloadNumber(event.payload.executionPrice, 4))}</td><td class="mono">${escapeHtml(formatPayloadNumber(event.payload.fee, 4))}</td><td class="mono">${pctPayload(event.payload.resultingExposure)}</td></tr>`).join('')}</tbody></table></div>`;
}

function rewardBreakdown(experience: Experience): string {
  const components = experience.rewardComponents;
  if (!components) return '<div class="placeholder compact">Reward component detail unavailable.</div>';
  return `${field('Excess return', formatSigned(components.excessReturn))}${field('λ', formatNumber(components.lambda, 4))}${field('Drawdown penalty', `-${formatNumber(components.drawdownPenalty, 4)}`)}`;
}

function traceSummary(trace: ExperienceTrace | null): string {
  if (!trace) return '<div class="placeholder compact">Trace unavailable.</div>';
  const warmup = trace.points.filter(point => point.isWarmup).length;
  const evaluated = trace.points.filter(point => point.isEvaluated).length;
  const last = trace.points.at(-1);
  return `${field('Warmup points', String(warmup))}${field('Evaluated points', String(evaluated))}${field('Final cash', money(last?.cash))}${field('Final quantity', formatNumber(last?.quantity ?? 0, 4))}`;
}

function traceTable(trace: ExperienceTrace | null): string {
  if (!trace) return '';
  return `<div class="inspector-table-viewport trace-table-viewport"><table class="inspector-data-table"><thead><tr><th>Time</th><th>Region</th><th>Close</th><th>Target</th><th>Qty</th><th>Equity</th><th>Exposure</th><th>Drawdown</th><th>Benchmark</th></tr></thead><tbody>${trace.points.map(point => `<tr><td class="mono">${escapeHtml(point.timestamp.slice(0,19))}</td><td>${point.isWarmup ? 'Warmup' : 'Evaluated'}</td><td class="mono">${formatNumber(point.close, 4)}</td><td class="mono">${point.decisionTarget == null ? '—' : pct(point.decisionTarget)}</td><td class="mono">${formatNumber(point.quantity, 4)}</td><td class="mono">${money(point.equity)}</td><td class="mono">${pct(point.exposure)}</td><td class="mono">${pct(point.drawdown)}</td><td class="mono">${money(point.benchmarkEquity)}</td></tr>`).join('')}</tbody></table></div>`;
}

function pctPayload(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? pct(value) : '—';
}

function emptyInspector(): string {
  return '<div class="inspector-section profile"><div class="eyebrow">Inspector</div><h2>No selection</h2><div class="placeholder">Select an Arena or Experience.</div></div>';
}

function field(label: string, value: string): string { return `<div class="field-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function money(value: number | null | undefined): string { return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; }
function pct(value: number | null | undefined): string { return typeof value === 'number' && Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${formatNumber(value * 100, 2)}%` : '—'; }
function formatSigned(value: number | null | undefined): string { return typeof value === 'number' && Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${formatNumber(value, 4)}` : '—'; }
function shortId(value: string): string { return value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value; }
function formatPayloadNumber(value: unknown, digits: number): string { return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value, digits) : '—'; }
