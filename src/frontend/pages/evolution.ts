import type { Entity, EvolutionRun } from '../../domain/types.js';
import { escapeHtml } from '../shared/escape.js';

export function renderEvolutionPage(runs: EvolutionRun[], candidates: Entity[], selectedId: string | null): { objects: string; workspace: string; inspector: string } {
  const selected = runs.find(run => run.id === selectedId) ?? null;
  return {
    objects: `<div class="panel-heading"><div><div class="eyebrow">Objects</div><h2>Evolution</h2></div></div><div class="objects-summary"><span>${runs.length} runs</span><span>${candidates.length} candidates</span></div>`,
    workspace: `<div class="workspace-header"><div><div class="eyebrow">Evolutionary research</div><h1>Evolution</h1></div><div class="workspace-actions"><span class="metric">${candidates.length} active candidates</span></div></div><div class="table-wrap">${runs.length ? table(runs, selectedId) : '<div class="empty-state"><strong>No Evolution runs yet.</strong><span>The scheduler is intentionally not faked in the foundation milestone. Candidates remain available in Entities.</span></div>'}</div>`,
    inspector: selected ? `<div class="inspector-section profile"><div class="eyebrow">Inspector</div><h2>${escapeHtml(selected.id)}</h2><div class="subtitle">${escapeHtml(selected.status)}</div></div><div class="inspector-section"><h3>Run</h3>${field('Cycle', String(selected.cycle))}${field('Active candidates', String(selected.activeCandidateCount))}${field('Proposer', selected.proposerType)}</div>` : '<div class="inspector-section profile"><div class="eyebrow">Inspector</div><h2>No run selected</h2><div class="placeholder">Evolution runs will appear here once the scheduler milestone begins.</div></div>'
  };
}

function table(runs: EvolutionRun[], selectedId: string | null): string { return `<table class="entity-table"><thead><tr><th>Run</th><th>Status</th><th>Cycle</th><th>Population</th><th>Proposer</th></tr></thead><tbody>${runs.map(run => `<tr data-run-id="${escapeHtml(run.id)}" class="${run.id === selectedId ? 'selected' : ''}" tabindex="0"><td><strong>${escapeHtml(run.id)}</strong></td><td><span class="status-chip">${escapeHtml(run.status)}</span></td><td>${run.cycle}</td><td>${run.activeCandidateCount}</td><td>${escapeHtml(run.proposerType)}</td></tr>`).join('')}</tbody></table>`; }
function field(label: string, value: string): string { return `<div class="field-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
