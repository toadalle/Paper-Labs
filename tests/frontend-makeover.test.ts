import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Entity } from '../src/domain/types.js';
import { applyEntityView, buildEntityRows } from '../src/frontend/entities/model.js';
import { renderEntitiesPage } from '../src/frontend/pages/entities.js';
import { renderConsolePage } from '../src/frontend/pages/console.js';
import type { ConsoleLogRecord } from '../src/frontend/types.js';

test('frontend shell no longer contains the old unreachable-panel media-query rules', () => {
  const css = readFileSync('public/styles.css', 'utf8');
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.doesNotMatch(css, /@media \(max-width: 76rem\)[\s\S]{0,240}\.inspector\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /@media \(max-width: 58rem\)[\s\S]{0,240}\.objects-panel\s*\{\s*display:\s*none/);
  assert.match(main, /surface-dock/);
  assert.match(main, /data-surface-target/);
  assert.doesNotMatch(main, /querySelectorAll<HTMLButtonElement>\('\[data-narrow-surface\]'\)/);
});

test('large Entity populations retain all rows for scroll/virtualization-ready rendering', () => {
  const base = '2026-08-31T12:00:00.000Z';
  const entities: Entity[] = Array.from({ length: 500 }, (_, index) => ({
    id: `entity_${index}`,
    name: `Entity ${index}`,
    family: index % 2 ? 'Odd' : 'Even',
    lifecycleState: 'PERMANENT' as const,
    candidateStatus: null,
    evolutionRunId: null,
    birthEvolutionRunId: null,
    parentEntityId: null,
    mutationOperator: null,
    configurationStatus: 'DRAFT',
    strategyType: null,
    strategyVersion: null,
    traits: {},
    traitHash: null,
    createdAt: base,
    retiredAt: null
  }));
  const metrics = Object.fromEntries(entities.map((entity, index) => [entity.id, { recentReward: index / 100, consistency: .5, age: index, lastActivity: base }]));
  const rows = applyEntityView(buildEntityRows(entities, metrics), '', {}, null);
  assert.equal(rows.length, 500);
  const page = renderEntitiesPage({
    rows,
    allEntityCount: 500,
    selectedEntityId: entities[0]!.id,
    search: '', searchDraft: '', filters: {}, sort: null, filterFlyout: null,
    recentEntities: entities.slice(0, 10), pinnedEntities: [],
    experienceCount: 0, snapshotCount: 0, arenaCount: 0, arenas: [], saveState: null, draftConfiguration: null
  });
  assert.match(page.workspace, /data-table-viewport="entities"/);
  assert.match(page.workspace, /Entity 499/);
});

test('Console log view remains table-viewport based with thousands of records', () => {
  const logs: ConsoleLogRecord[] = Array.from({ length: 2000 }, (_, index) => ({
    timestamp: '2026-08-31T12:00:00.000Z', level: 'INFO', category: 'stress', event: `EVENT_${index}`,
    message: `Message ${index}`, correlationId: `corr-${index}`, requestId: null, entityId: null, arenaId: null,
    experienceId: null, evolutionRunId: null, snapshotId: null, durationMs: index, error: null, context: {}
  }));
  const page = renderConsolePage({
    view: 'LOGS', overview: null, logs, auditEvents: [], loading: false, error: null,
    selectedLogIndex: null, selectedAuditId: null, logSearch: '', logLevel: 'ALL'
  });
  assert.match(page.workspace, /data-table-viewport="console"/);
  assert.match(page.workspace, /EVENT_1999/);
});


test('responsive surface controls use dedicated targets and cannot bubble back into shell state', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(main, /\.surface-dock-tab\[data-surface-target\]/);
  assert.match(main, /state\.narrowSurface = surface/);
  assert.doesNotMatch(main, /querySelectorAll<HTMLButtonElement>\('\[data-narrow-surface\]'\)/);
});

test('Live preferences have no implicit default market symbol', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(main, /const LIVE_PREF_KEY = 'paper-lab\.live\.v2'/);
  assert.doesNotMatch(main, /:\s*\[defaultAsset\('SPY', 'US_EQUITY'\)\]/);
  assert.match(main, /objects\[0\]\?\.symbol \?\? ''/);
});

test('toast progress and active-time clocks are per-notification and pause on blur or hidden state', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  const css = readFileSync('public/styles.css', 'utf8');
  assert.match(main, /const toastTimers = new Map<string, number>\(\)/);
  assert.match(main, /const toastQueue: ClientToast\[\] = \[\]/);
  assert.match(main, /notification-toast-host/);
  assert.match(main, /requestAnimationFrame\(tick\)/);
  assert.match(main, /data-toast-progress/);
  assert.doesNotMatch(main, /state\.toasts = \[\.\.\.state\.toasts, toast\]\.slice\(-5\)/);
  assert.doesNotMatch(css, /notification-countdown/);
  assert.match(main, /document\.hasFocus\(\)/);
  assert.match(main, /window\.addEventListener\('blur', syncToastClock\)/);
  assert.match(main, /window\.addEventListener\('focus', syncToastClock\)/);
});

test('toast presentation coalesces repeated severities while preserving independent severity cards', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(main, /supersedeToastSeverity\(toast\.severity\)/);
  assert.match(main, /state\.toasts = state\.toasts\.filter\(item => item\.severity !== severity\)/);
  assert.match(main, /toastQueue\.splice\(index, 1\)/);
  assert.match(main, /markSupersededToastDismissed/);
  assert.match(main, /const supersededToastKeys = new Set<string>\(\)/);
});

test('Inspector action grids auto-fit buttons and wrap long labels without breaking alignment', () => {
  const css = readFileSync('public/styles.css', 'utf8');
  assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 7\.25rem\), 1fr\)\)/);
  assert.match(css, /white-space: normal/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /align-items: stretch/);
});


test('constrained mode uses the surface dock as a full-focus controller instead of side overlays', () => {
  const css = readFileSync('public/styles.css', 'utf8');
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(css, /shell-mode-constrained \.shell-body\[data-active-surface="OBJECTS"\] \.objects-panel \{ display: block; \}/);
  assert.match(css, /shell-mode-constrained \.shell-body\[data-active-surface="WORKSPACE"\] \.workspace \{ display: grid; \}/);
  assert.match(css, /shell-mode-constrained \.shell-body\[data-active-surface="INSPECTOR"\] \.inspector \{ display: block; \}/);
  assert.doesNotMatch(css, /data-constrained-overlay="OBJECTS"/);
  assert.match(main, /const active: ShellSurface = state\.narrowSurface/);
});

test('Live asset search does not rerender the entire app on each input keystroke', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  const inputBlock = main.match(/search\?\.addEventListener\('input',[\s\S]*?scheduleAssetSearch\(180\);\n  \}\);/)?.[0] ?? '';
  assert.match(inputBlock, /state\.liveSearch =/);
  assert.doesNotMatch(inputBlock, /render\(\)/);
});

test('Live watchlist preferences are persisted across full-page navigation', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(main, /normalizeSelections\(\);\n    persistLivePreferences\(\);/);
  assert.match(main, /window\.addEventListener\('pagehide', \(\) => persistLivePreferences\(\)\)/);
});

test('timed toast hover pauses only that toast and resumes its remaining time', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(main, /element\.addEventListener\('mouseenter', \(\) => pauseSingleToast\(toast\.key\)\)/);
  assert.match(main, /element\.addEventListener\('mouseleave', \(\) => resumeSingleToast\(toast\.key\)\)/);
  assert.match(main, /toast\.hoverPaused = true/);
  assert.match(main, /toast\.hoverPaused = false/);
  assert.match(main, /!toastClockActive \|\| toast\.hoverPaused/);
});

test('Live tracked symbols can be removed through context menu and Inspector Actions', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  const live = readFileSync('src/frontend/pages/live.ts', 'utf8');
  assert.match(main, /row\.addEventListener\('contextmenu'/);
  assert.match(main, /function removeLiveObject\(symbol: string\)/);
  assert.match(main, /#live-inspector-remove/);
  assert.match(live, /id=\"live-inspector-remove\"/);
  assert.match(live, />Remove from watchlist<\/button>/);
  assert.match(main, /state\.liveObjects = remaining/);
  assert.match(main, /state\.liveComparisonSymbols = state\.liveComparisonSymbols\.filter/);
});

test('notification filtering uses multiple AND-combined Condition + Value rules without per-keystroke rerender', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  assert.match(main, /notificationFilters: NotificationFilterRule\[\]/);
  assert.match(main, /state\.notificationFilters\.every\(rule => notificationMatchesRule\(item, rule\)\)/);
  assert.match(main, /<span>Condition<\/span>/);
  assert.match(main, /<span>Value<\/span>/);
  assert.match(main, /filter-rule-pill/);
  const inputBlock = main.match(/#notification-filter-value'\)\?\.addEventListener\('input',[\s\S]*?\n  \}\);/)?.[0] ?? '';
  assert.match(inputBlock, /notificationFilterDraftValue/);
  assert.doesNotMatch(inputBlock, /render\(\)/);
});

test('Notification history uses a toggleable right-side panel with inline filter editing', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  const css = readFileSync('public/styles.css', 'utf8');
  assert.match(main, /renderNotificationPanel\(\)/);
  assert.match(main, /class="notification-panel shell-notification-/);
  assert.match(main, /notification-panel-close/);
  assert.match(main, /notification-filter-editor/);
  assert.doesNotMatch(main, /notification-filter-flyout/);
  assert.match(main, /notificationCenterOpen && !target\?\.closest\('\.notification-panel'\) && !target\?\.closest\('#notification-bell'\)/);
  assert.match(css, /\.notification-panel \{/);
  assert.match(css, /position: fixed;/);
  assert.match(css, /right: 0;/);
  assert.match(css, /bottom: 0;/);
  assert.match(css, /\.notification-filter-editor \{/);
  assert.doesNotMatch(css, /\.notification-filter-flyout \{/);
});

test('opening Notification History expires the active toast surface and unfiltered history renders chronological groups', () => {
  const main = readFileSync('src/frontend/main.ts', 'utf8');
  const css = readFileSync('public/styles.css', 'utf8');
  assert.match(main, /if \(opening\) \{[\s\S]*?expireToastSurface\(\)/);
  assert.match(main, /function expireToastSurface\(\)/);
  assert.match(main, /state\.toasts = \[\]/);
  assert.match(main, /toastQueue\.splice\(0, toastQueue\.length\)/);
  assert.match(main, /renderGroupedNotificationHistory/);
  assert.match(main, /state\.notificationFilters\.length \? rows\.map\(renderNotificationHistoryRow\)/);
  assert.match(main, /data-notification-group/);
  assert.match(css, /\.notification-history-group/);
});
