import type { AuditEvent } from '../../domain/types.js';
import type { ConsoleLogRecord, ConsoleOverviewView } from '../types.js';
import { escapeHtml } from '../shared/escape.js';

export type ConsoleView = 'OVERVIEW' | 'LOGS' | 'AUDIT' | 'DIAGNOSTICS';

export interface ConsolePageInput {
  view: ConsoleView;
  overview: ConsoleOverviewView | null;
  logs: ConsoleLogRecord[];
  auditEvents: AuditEvent[];
  loading: boolean;
  error: string | null;
  selectedLogIndex: number | null;
  selectedAuditId: string | null;
  logSearch: string;
  logLevel: string;
}

export function renderConsolePage(input: ConsolePageInput): { objects: string; workspace: string; inspector: string } {
  return {
    objects: renderObjects(input.view),
    workspace: renderWorkspace(input),
    inspector: renderInspector(input)
  };
}

function renderObjects(view: ConsoleView): string {
  return `
    <div class="panel-heading"><div><div class="eyebrow">Objects</div><h2>Console</h2></div></div>
    <div class="console-nav-list">
      ${consoleNav('OVERVIEW', 'Overview', view)}
      ${consoleNav('LOGS', 'Logs', view)}
      ${consoleNav('AUDIT', 'Audit', view)}
      ${consoleNav('DIAGNOSTICS', 'Diagnostics', view)}
    </div>`;
}

function consoleNav(key: ConsoleView, label: string, current: ConsoleView): string {
  return `<button class="console-nav-row ${key === current ? 'selected' : ''}" data-console-view="${key}" type="button">${label}</button>`;
}

function renderWorkspace(input: ConsolePageInput): string {
  const title = input.view === 'OVERVIEW' ? 'System overview' : input.view === 'LOGS' ? 'Operational logs' : input.view === 'AUDIT' ? 'Audit trail' : 'Diagnostics';
  return `
    <div class="workspace-header console-workspace-header">
      <div><div class="eyebrow">Observability</div><h1>${title}</h1></div>
      ${input.view === 'LOGS' ? `<div class="console-log-controls"><input id="console-log-search" class="control" value="${escapeHtml(input.logSearch)}" placeholder="Search logs"><select id="console-log-level" class="control"><option value="ALL">All levels</option>${['DEBUG','INFO','WARN','ERROR','FATAL'].map(level => `<option value="${level}" ${input.logLevel === level ? 'selected' : ''}>${level}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="console-workspace">
      ${input.loading ? '<div class="empty-state"><strong>Loading Console…</strong></div>' : input.error ? `<div class="empty-state"><strong>Console unavailable.</strong><span>${escapeHtml(input.error)}</span></div>` : content(input)}
    </div>`;
}

function content(input: ConsolePageInput): string {
  if (input.view === 'OVERVIEW') return overview(input.overview);
  if (input.view === 'LOGS') return logs(input);
  if (input.view === 'AUDIT') return audit(input);
  return diagnostics(input.overview);
}

function overview(value: ConsoleOverviewView | null): string {
  if (!value) return '<div class="empty-state"><strong>No system data loaded.</strong></div>';
  return `<div class="console-card-grid">
    ${card('Application', field('Version', value.version) + field('Uptime', duration(value.uptimeSeconds)) + field('Runtime', `${value.node} · ${value.platform}/${value.arch}`))}
    ${card('Provider', field('Configured', value.provider.configured ? 'Yes' : 'No') + field('Checked', value.provider.checkedAt ?? 'Not probed') + field('Asset classes', value.provider.assetClasses.join(', ')))}
    ${card('Integrity', field('Audit integrity', value.auditIntegrity.valid ? 'Valid' : 'FAILED') + field('Audit events', String(value.counts.auditEvents)) + field('Snapshots', String(value.counts.snapshots)))}
    ${card('Activity', field('Notifications', String(value.counts.notifications)) + field('Experiences', String(value.counts.experiences)))}
  </div>`;
}

function logs(input: ConsolePageInput): string {
  const q = input.logSearch.trim().toLowerCase();
  const rows = input.logs.filter(log => (input.logLevel === 'ALL' || log.level === input.logLevel) && (!q || `${log.timestamp} ${log.level} ${log.category} ${log.event} ${log.message} ${log.correlationId ?? ''}`.toLowerCase().includes(q)));
  if (!rows.length) return '<div class="empty-state"><strong>No matching log records.</strong></div>';
  return `<div class="console-table-wrap table-viewport" data-table-viewport="console"><table class="console-table"><thead><tr><th>Time</th><th>Level</th><th>Category</th><th>Event</th><th>Message</th></tr></thead><tbody>${rows.map((log, index) => `<tr data-console-log-index="${input.logs.indexOf(log)}" class="${input.selectedLogIndex === input.logs.indexOf(log) ? 'selected' : ''}" tabindex="0"><td class="mono">${escapeHtml(shortTime(log.timestamp))}</td><td><span class="log-level log-${log.level.toLowerCase()}">${log.level}</span></td><td>${escapeHtml(log.category)}</td><td class="mono">${escapeHtml(log.event)}</td><td>${escapeHtml(log.message)}</td></tr>`).join('')}</tbody></table></div>`;
}

function audit(input: ConsolePageInput): string {
  if (!input.auditEvents.length) return '<div class="empty-state"><strong>No AuditEvents yet.</strong></div>';
  return `<div class="console-table-wrap table-viewport" data-table-viewport="console"><table class="console-table"><thead><tr><th>#</th><th>Time</th><th>Event</th><th>Subject</th><th>Summary</th></tr></thead><tbody>${input.auditEvents.map(event => `<tr data-console-audit-id="${escapeHtml(event.id)}" class="${event.id === input.selectedAuditId ? 'selected' : ''}" tabindex="0"><td class="mono">${event.sequence}</td><td class="mono">${escapeHtml(shortTime(event.occurredAt))}</td><td>${escapeHtml(event.eventType)}</td><td>${escapeHtml(event.subject.type)} · ${escapeHtml(event.subject.id)}</td><td>${escapeHtml(event.summary)}</td></tr>`).join('')}</tbody></table></div>`;
}

function diagnostics(value: ConsoleOverviewView | null): string {
  return `<div class="console-card-grid">
    ${card('Diagnostics export', '<p class="console-copy">Generate a sanitized diagnostics bundle for troubleshooting. Credentials are excluded.</p><button id="console-export-diagnostics" class="button primary" type="button">Export diagnostics</button>')}
    ${card('Audit integrity', `<p class="console-copy">${value?.auditIntegrity.valid ? 'Current audit hash chain is valid.' : 'Audit integrity requires attention.'}</p><button id="console-verify-audit" class="button" type="button">Verify audit integrity</button>`)}
    ${card('Market-data artifacts', '<p class="console-copy">Verify persisted research snapshot artifacts and trigger compromised-source propagation when evidence fails integrity.</p><button id="console-verify-market-data" class="button" type="button">Verify market data</button>')}
  </div>`;
}

function renderInspector(input: ConsolePageInput): string {
  if (input.view === 'LOGS' && input.selectedLogIndex !== null) {
    const log = input.logs[input.selectedLogIndex];
    if (log) return `<div class="inspector-section profile"><div class="eyebrow">Inspector · Log</div><h2>${escapeHtml(log.event)}</h2><div class="subtitle">${escapeHtml(log.timestamp)}</div></div><div class="inspector-section"><h3>Record</h3>${field('Level', log.level)}${field('Category', log.category)}${field('Message', log.message)}${field('Correlation', log.correlationId ?? '—')}${field('Request', log.requestId ?? '—')}${field('Duration', log.durationMs === null ? '—' : `${log.durationMs} ms`)}</div>${log.error ? `<div class="inspector-section"><h3>Error</h3>${field('Name', log.error.name)}${field('Message', log.error.message)}<div class="placeholder mono">${escapeHtml(log.error.stack ?? 'No stack')}</div></div>` : ''}`;
  }
  if (input.view === 'AUDIT' && input.selectedAuditId) {
    const event = input.auditEvents.find(item => item.id === input.selectedAuditId);
    if (event) return `<div class="inspector-section profile"><div class="eyebrow">Inspector · Audit</div><h2>${escapeHtml(event.eventType)}</h2><div class="subtitle mono">${escapeHtml(event.id)}</div></div><div class="inspector-section"><h3>Evidence</h3>${field('Sequence', String(event.sequence))}${field('Actor', event.actor.type)}${field('Subject', `${event.subject.type} · ${event.subject.id}`)}${field('Correlation', event.correlationId)}${field('Event hash', event.eventHash)}${field('Previous hash', event.previousEventHash ?? 'Genesis')}</div><div class="inspector-section"><h3>Summary</h3><div class="placeholder">${escapeHtml(event.summary)}</div></div>`;
  }
  return `<div class="inspector-section profile"><div class="eyebrow">Inspector</div><h2>Console</h2><div class="subtitle">Select a log or AuditEvent for details.</div></div>`;
}

function card(title: string, body: string): string { return `<section class="console-card"><h3>${escapeHtml(title)}</h3>${body}</section>`; }
function field(label: string, value: string): string { return `<div class="field-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function shortTime(value: string): string { return new Date(value).toLocaleString(); }
function duration(seconds: number): string { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`; }
