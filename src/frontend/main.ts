import type { Arena, Entity, Experience, MarketAsset, MarketAssetClass, NotificationEvent, NotificationSeverity } from '../domain/types.js';
import { api } from './api.js';
import { renderArenasPage } from './pages/arenas.js';
import { renderBenchmarkPage } from './pages/benchmark.js';
import { renderEntitiesPage, type EntityDraftConfigurationView, type EntityFilterFlyout } from './pages/entities.js';
import { renderEvolutionPage } from './pages/evolution.js';
import { renderLivePage, type LiveInspectorContext, type LiveRange } from './pages/live.js';
import { renderConsolePage, type ConsoleView } from './pages/console.js';
import { escapeHtml } from './shared/escape.js';
import { filterIcon } from './shared/icons.js';
import { lifecycleActionForEntity, type EntityLifecycleActionId } from './domain-ui/entity-actions.js';
import { placeAnchoredFlyout } from './shared/flyout.js';
import { readPreference, writePreference } from './shared/preferences.js';
import { deriveShellMode, shouldSelectionOpenInspector, type ShellMode, type ShellSurface } from './shell/responsive.js';
import { groupNotificationHistory } from './notifications/history.js';
import { ARENA_CREATE_DEFAULTS } from '../domain/create-defaults.js';
import {
  DEFAULT_ENTITY_FILTERS,
  applyEntityView,
  buildEntityRows,
  operatorsFor,
  type EntityColumnFilter,
  type EntityColumnKey,
  type EntityFilters,
  type EntitySort,
  type EntityFilterOperator
} from './entities/model.js';
import { FULL_VIEWPORT, compareHoverPoint, panViewport, singleHoverPoint, zoomViewport, type ChartViewport, type CompareChartSeries, type LiveChartMode, type LiveMouseDetails } from './live/chart.js';
import type { AssetSearchView, BootstrapView, ConsoleAuditView, ConsoleLogsView, ConsoleOverviewView, ExperienceDetailView, LiveChartView, LiveQuoteView, NotificationListView, PortableImportPlanView, PortableImportResultView, PortableImportSurface } from './types.js';

type AppPage = 'LIVE' | 'ENTITIES' | 'ARENAS' | 'EVOLUTION' | 'BENCHMARK' | 'CONSOLE';
type NotificationFilterCondition = 'IS' | 'IS_NOT' | 'CONTAINS' | 'NOT_CONTAINS';
interface NotificationFilterRule { condition: NotificationFilterCondition; value: string; }
interface LiveContextMenu { symbol: string; left: number; top: number; }
interface EntityContextMenu { entityId: string; left: number; top: number; }
interface EntityLifecycleConfirm { entityId: string; action: EntityLifecycleActionId; }
interface ClientToast { key: string; notificationId: string | null; severity: NotificationSeverity; title: string; message: string; durationMs: number | null; remainingMs: number | null; startedAt: number | null; hoverPaused: boolean; }

interface EntityPreferences {
  recent: string[];
  pinned: string[];
  sort: EntitySort | null;
  filters: EntityFilters;
}

interface LivePreferences {
  objects: MarketAsset[];
  comparisonSymbols: string[];
  activeSymbol: string;
  range: LiveRange;
  mode: LiveChartMode;
  compareEnabled: boolean;
  stockFeed: string;
}

const ENTITY_PREF_KEY = 'paper-lab.entities.v1';
const LIVE_PREF_KEY = 'paper-lab.live.v2';
const initialEntityPrefs = normalizeEntityPreferences(readPreference<Partial<EntityPreferences>>(ENTITY_PREF_KEY, {}));
const initialLivePrefs = normalizeLivePreferences(readPreference<Partial<LivePreferences>>(LIVE_PREF_KEY, {}));
const locationSymbol = symbolFromLocation();
const initialShellMode = deriveShellMode(document.documentElement.clientWidth || window.innerWidth, rootFontPx());
if (locationSymbol && !initialLivePrefs.objects.some(asset => asset.symbol === locationSymbol)) {
  initialLivePrefs.objects.unshift(defaultAsset(locationSymbol, 'US_EQUITY'));
  initialLivePrefs.activeSymbol = locationSymbol;
}

const state: {
  data: BootstrapView | null;
  page: AppPage;
  selectedEntityId: string | null;
  selectedArenaId: string | null;
  selectedExperienceId: string | null;
  experienceDetail: ExperienceDetailView | null;
  experienceLoading: boolean;
  arenaCreateMode: boolean;
  selectedRunId: string | null;

  shellMode: ShellMode;
  narrowSurface: ShellSurface;
  constrainedOverlay: Exclude<ShellSurface, 'WORKSPACE'> | null;

  entitySearch: string;
  entitySearchDraft: string;
  entitySort: EntitySort | null;
  entityFilters: EntityFilters;
  entityFilterFlyout: EntityFilterFlyout | null;
  recentEntityIds: string[];
  pinnedEntityIds: string[];
  entitySaveState: string | null;
  entityDraftConfiguration: EntityDraftConfigurationView | null;
  entityContextMenu: EntityContextMenu | null;
  entityLifecycleConfirm: EntityLifecycleConfirm | null;

  importOpen: boolean;
  importSurface: PortableImportSurface | null;
  importTargetId: string | null;
  importText: string;
  importPlan: PortableImportPlanView | null;
  importBusy: boolean;
  importError: string | null;

  liveObjects: MarketAsset[];
  liveActiveSymbol: string;
  liveComparisonSymbols: string[];
  liveRange: LiveRange;
  liveMode: LiveChartMode;
  liveCompareEnabled: boolean;
  liveStockFeed: string;
  liveInspectorContext: LiveInspectorContext;
  liveQuote: LiveQuoteView | null;
  liveChart: LiveChartView | null;
  liveCompareSeries: CompareChartSeries[];
  liveViewport: ChartViewport;
  liveMouseDetails: LiveMouseDetails | null;
  liveLoading: boolean;
  liveError: string | null;
  liveSearch: string;
  liveSearchOpen: boolean;
  liveSearchLoading: boolean;
  liveSearchError: string | null;
  liveSearchResults: MarketAsset[];
  liveRequestToken: number;
  liveContextMenu: LiveContextMenu | null;

  consoleView: ConsoleView;
  consoleOverview: ConsoleOverviewView | null;
  consoleLogs: ConsoleLogsView['logs'];
  consoleAuditEvents: ConsoleAuditView['events'];
  consoleLoading: boolean;
  consoleError: string | null;
  consoleSelectedLogIndex: number | null;
  consoleSelectedAuditId: string | null;
  consoleLogSearch: string;
  consoleLogLevel: string;

  notifications: NotificationEvent[];
  notificationTotal: number;
  notificationCenterOpen: boolean;
  notificationFilterOpen: boolean;
  notificationFilters: NotificationFilterRule[];
  notificationFilterDraftCondition: NotificationFilterCondition;
  notificationFilterDraftValue: string;
  toasts: ClientToast[];

  loading: boolean;
  error: string | null;
} = {
  data: null,
  page: pageFromLocation(),
  selectedEntityId: entityFromLocation(),
  selectedArenaId: null,
  selectedExperienceId: null,
  experienceDetail: null,
  experienceLoading: false,
  arenaCreateMode: false,
  selectedRunId: null,

  shellMode: initialShellMode,
  narrowSurface: 'WORKSPACE',
  constrainedOverlay: null,

  entitySearch: '',
  entitySearchDraft: '',
  entitySort: initialEntityPrefs.sort,
  entityFilters: initialEntityPrefs.filters,
  entityFilterFlyout: null,
  recentEntityIds: initialEntityPrefs.recent,
  pinnedEntityIds: initialEntityPrefs.pinned,
  entitySaveState: null,
  entityDraftConfiguration: null,
  entityContextMenu: null,
  entityLifecycleConfirm: null,

  importOpen: false,
  importSurface: null,
  importTargetId: null,
  importText: '',
  importPlan: null,
  importBusy: false,
  importError: null,

  liveObjects: initialLivePrefs.objects,
  liveActiveSymbol: locationSymbol ?? initialLivePrefs.activeSymbol,
  liveComparisonSymbols: initialLivePrefs.comparisonSymbols,
  liveRange: initialLivePrefs.range,
  liveMode: initialLivePrefs.mode,
  liveCompareEnabled: initialLivePrefs.compareEnabled,
  liveStockFeed: initialLivePrefs.stockFeed,
  liveInspectorContext: 'SYMBOL',
  liveQuote: null,
  liveChart: null,
  liveCompareSeries: [],
  liveViewport: { ...FULL_VIEWPORT },
  liveMouseDetails: null,
  liveLoading: false,
  liveError: null,
  liveSearch: '',
  liveSearchOpen: false,
  liveSearchLoading: false,
  liveSearchError: null,
  liveSearchResults: [],
  liveRequestToken: 0,
  liveContextMenu: null,

  consoleView: consoleViewFromLocation(),
  consoleOverview: null,
  consoleLogs: [],
  consoleAuditEvents: [],
  consoleLoading: false,
  consoleError: null,
  consoleSelectedLogIndex: null,
  consoleSelectedAuditId: null,
  consoleLogSearch: '',
  consoleLogLevel: 'ALL',

  notifications: [],
  notificationTotal: 0,
  notificationCenterOpen: false,
  notificationFilterOpen: false,
  notificationFilters: [],
  notificationFilterDraftCondition: 'IS',
  notificationFilterDraftValue: '',
  toasts: [],

  loading: true,
  error: null
};

let assetSearchTimer: number | null = null;
let entitySearchTimer: number | null = null;
const MAX_VISIBLE_TOASTS = 5;
const toastTimers = new Map<string, number>();
const toastQueue: ClientToast[] = [];
const supersededToastKeys = new Set<string>();
const notificationGroupOpenState = new Map<string, boolean>();
let toastProgressFrame: number | null = null;

const appNode = document.querySelector<HTMLElement>('#app');
if (!appNode) throw new Error('App root not found.');
const app = appNode;

const toastHost = document.createElement('div');
toastHost.id = 'notification-toast-host';
toastHost.className = `notification-toast-stack shell-notification-${state.shellMode}${state.notificationCenterOpen ? ' notification-panel-open' : ''}`;
toastHost.setAttribute('aria-live', 'polite');
toastHost.setAttribute('aria-label', 'Application notifications');
document.body.appendChild(toastHost);
toastHost.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-dismiss-toast]') : null;
  if (target?.dataset.dismissToast) void dismissToast(target.dataset.dismissToast);
});

let shellResizeFrame: number | null = null;
window.addEventListener('resize', scheduleShellModeUpdate);
if (typeof ResizeObserver !== 'undefined') {
  const shellObserver = new ResizeObserver(scheduleShellModeUpdate);
  shellObserver.observe(document.documentElement);
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  let changed = false;
  if (state.liveSearchOpen && !target?.closest('.asset-search-wrap')) {
    state.liveSearchOpen = false;
    changed = true;
  }
  if (state.liveContextMenu && !target?.closest('.context-menu')) {
    state.liveContextMenu = null;
    changed = true;
  }
  if (state.entityContextMenu && !target?.closest('.context-menu')) {
    state.entityContextMenu = null;
    changed = true;
  }
  if (state.entityFilterFlyout && !target?.closest('.filter-flyout') && !target?.closest('[data-filter-column]')) {
    state.entityFilterFlyout = null;
    changed = true;
  }
  if (state.notificationCenterOpen && !target?.closest('.notification-panel') && !target?.closest('#notification-bell')) {
    state.notificationCenterOpen = false;
    state.notificationFilterOpen = false;
    changed = true;
  }
  if (state.importOpen && !target?.closest('.portable-import-panel') && !target?.closest('[data-portable-import-toggle]')) {
    state.importOpen = false;
    state.importSurface = null;
    state.importTargetId = null;
    state.importPlan = null;
    state.importError = null;
    changed = true;
  }
  if (state.shellMode === 'constrained' && state.constrainedOverlay) {
    const panelSelector = state.constrainedOverlay === 'OBJECTS' ? '[data-shell-panel=\"OBJECTS\"]' : '[data-shell-panel=\"INSPECTOR\"]';
    const toggleSelector = `[data-surface-target=\"${state.constrainedOverlay}\"]`;
    if (!target?.closest(panelSelector) && !target?.closest(toggleSelector)) {
      state.constrainedOverlay = null;
      changed = true;
    }
  }
  if (changed) render();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  let changed = false;
  if (state.liveSearchOpen) { state.liveSearchOpen = false; changed = true; }
  if (state.liveContextMenu) { state.liveContextMenu = null; changed = true; }
  if (state.entityContextMenu) { state.entityContextMenu = null; changed = true; }
  if (state.entityLifecycleConfirm) { state.entityLifecycleConfirm = null; changed = true; }
  if (state.entityFilterFlyout) { state.entityFilterFlyout = null; changed = true; }
  if (state.importOpen) { state.importOpen = false; state.importSurface = null; state.importTargetId = null; state.importPlan = null; state.importError = null; changed = true; }
  if (state.notificationFilterOpen) { state.notificationFilterOpen = false; changed = true; }
  else if (state.notificationCenterOpen) { state.notificationCenterOpen = false; changed = true; }
  if (state.constrainedOverlay) { state.constrainedOverlay = null; changed = true; }
  if (changed) render();
});

void load();

async function load(): Promise<void> {
  state.loading = true;
  state.error = null;
  render();
  try {
    state.data = await api<BootstrapView>('/api/bootstrap');
    normalizeSelections();
    persistLivePreferences();
  } catch (error) {
    state.error = message(error);
  } finally {
    state.loading = false;
    render();
  }
  await refreshNotifications(false);
  if (state.page === 'LIVE') void refreshLiveData();
  if (state.page === 'CONSOLE') void refreshConsole();
}

function normalizeSelections(): void {
  if (!state.data) return;
  const rows = visibleEntityRows();
  if (!state.selectedEntityId || !state.data.entities.some(entity => entity.id === state.selectedEntityId)) {
    state.selectedEntityId = rows[0]?.entity.id ?? null;
  }
  state.recentEntityIds = state.recentEntityIds.filter(id => state.data!.entities.some(entity => entity.id === id)).slice(0, 10);
  state.pinnedEntityIds = state.pinnedEntityIds.filter(id => state.data!.entities.some(entity => entity.id === id));
  persistEntityPreferences();

  if (!state.selectedArenaId || !state.data.arenas.some(arena => arena.id === state.selectedArenaId)) {
    state.selectedArenaId = state.data.arenas[0]?.id ?? null;
  }
  if (state.selectedExperienceId && !state.data.experiences.some(experience => experience.id === state.selectedExperienceId)) {
    state.selectedExperienceId = null;
    state.experienceDetail = null;
  }
  if (!state.selectedRunId || !state.data.evolutionRuns.some(run => run.id === state.selectedRunId)) {
    state.selectedRunId = state.data.evolutionRuns[0]?.id ?? null;
  }
  if (!state.liveObjects.some(asset => asset.symbol === state.liveActiveSymbol)) {
    state.liveActiveSymbol = state.liveObjects[0]?.symbol ?? '';
  }
}

function allEntityRows() {
  return state.data ? buildEntityRows(state.data.entities, state.data.entityMetrics) : [];
}

function visibleEntityRows() {
  return applyEntityView(allEntityRows(), state.entitySearch, state.entityFilters, state.entitySort);
}

function render(): void {
  if (state.loading) {
    app.innerHTML = '<div class="boot-state">Loading Paper Lab…</div>';
    return;
  }
  if (state.error || !state.data) {
    app.innerHTML = `<div class="boot-state error">${escapeHtml(state.error ?? 'Unable to load application.')}</div>`;
    return;
  }

  const page = renderPage();
  const providerState = state.data.provider.checkedAt
    ? (state.data.provider.configured ? 'Checked' : 'Not configured')
    : 'Unchecked';

  app.innerHTML = `
    <div class="app-shell shell-mode-${state.shellMode}">
      <header class="app-header">
        <div class="brand"><span class="brand-name">${escapeHtml(state.data.product.name)}</span><span class="version">${escapeHtml(state.data.product.version)}</span></div>
        <nav class="top-nav" aria-label="Primary">
          ${nav('LIVE', 'Live')}${nav('ENTITIES', 'Entities')}${nav('ARENAS', 'Arenas')}${nav('EVOLUTION', 'Evolution')}${nav('BENCHMARK', 'Benchmark')}${nav('CONSOLE', 'Console')}
        </nav>
        <div class="header-tools">
          <button id="notification-bell" class="notification-bell" type="button" aria-label="Notifications" aria-expanded="${state.notificationCenterOpen ? 'true' : 'false'}">${bellIcon()}${unreadNotificationCount() ? `<span class="notification-badge">${unreadNotificationCount() > 99 ? '99+' : unreadNotificationCount()}</span>` : ''}</button>
          <button id="probe-provider" class="header-status" type="button" aria-label="Alpaca provider status: ${escapeHtml(providerState)}" title="Alpaca · ${escapeHtml(providerState)}"><span class="provider-name">Alpaca</span><span class="provider-state"> · ${escapeHtml(providerState)}</span></button>
        </div>
      </header>
      <div class="shell-body" data-active-surface="${state.narrowSurface}" data-constrained-overlay="${state.constrainedOverlay ?? 'NONE'}">
        <aside class="objects-panel panel" data-shell-panel="OBJECTS" ${surfaceHiddenAttributes('OBJECTS')}>${page.objects}</aside>
        <main class="workspace panel" data-shell-panel="WORKSPACE" ${surfaceHiddenAttributes('WORKSPACE')}>${page.workspace}</main>
        <aside class="inspector panel" data-shell-panel="INSPECTOR" ${surfaceHiddenAttributes('INSPECTOR')}>${page.inspector}</aside>
      </div>
      ${state.shellMode !== 'desktop' ? surfaceDock() : ''}
    </div>
    ${state.notificationCenterOpen ? renderNotificationPanel() : ''}
    ${state.liveContextMenu ? renderLiveContextMenu() : ''}
    ${state.entityContextMenu ? renderEntityContextMenu() : ''}
    ${state.entityLifecycleConfirm ? renderEntityLifecycleModal() : ''}
    ${state.importOpen ? renderPortableImportPanel() : ''}
  `;
  wireEvents();
  syncToastHost();
  queueMicrotask(() => { positionOpenFlyouts(); document.querySelector<HTMLElement>('.top-nav .nav-item.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); });
}

function renderPortableImportPanel(): string {
  const surface = state.importSurface;
  if (!surface) return '';
  const selectedName = surface === 'ENTITY_SELECTED'
    ? state.data?.entities.find(item => item.id === state.importTargetId)?.name ?? 'Selected Entity'
    : surface === 'ARENA_SELECTED'
      ? state.data?.arenas.find(item => item.id === state.importTargetId)?.name ?? 'Selected Arena'
      : surface === 'ENTITY_OBJECTS' ? 'Entities' : 'Arenas';
  const mode = surface.endsWith('_SELECTED') ? `Patch ${selectedName}` : `Create from ${selectedName}`;
  const plan = state.importPlan;
  return `<aside class="portable-import-panel shell-import-${state.shellMode}" aria-label="Portable Import">
    <div class="portable-import-header"><div><div class="eyebrow">Portable Research · PLPS v1</div><h2>Import Code</h2><div class="subtitle">${escapeHtml(mode)}</div></div><button id="portable-import-close" class="icon-button" type="button" aria-label="Close Import">×</button></div>
    <div class="portable-import-body">
      <label class="portable-import-code"><span>Paste JSON</span><textarea id="portable-import-text" class="control mono" spellcheck="false" placeholder='{"format":"paper-lab","version":1,"kind":"entity","spec":{...}}'>${escapeHtml(state.importText)}</textarea></label>
      <div class="portable-import-actions"><button id="portable-import-preview" class="button ${plan ? '' : 'primary'}" type="button" ${state.importBusy ? 'disabled' : ''}>${state.importBusy && !plan ? 'Planning…' : 'Preview'}</button>${plan ? `<button id="portable-import-apply" class="button primary" type="button" ${!plan.valid || state.importBusy ? 'disabled' : ''}>${state.importBusy ? 'Applying…' : 'Apply Plan'}</button>` : ''}</div>
      ${state.importError ? `<div class="import-message error"><strong>Import error</strong><span>${escapeHtml(state.importError)}</span></div>` : ''}
      ${plan ? renderImportPlan(plan) : `<div class="placeholder compact">Pasting never mutates data. Preview resolves this code through backend schema and domain rules first. Missing patch fields stay unchanged; READY trait edits become a new DRAFT Variant; used Arena edits become a new Arena version.</div>`}
    </div>
  </aside>`;
}

function renderImportPlan(plan: PortableImportPlanView): string {
  const warning = plan.warnings.length ? `<div class="import-message warning">${plan.warnings.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>` : '';
  const errors = plan.errors.length ? `<div class="import-message error">${plan.errors.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</div>` : '';
  const operations = plan.operations.map(operation => `<section class="import-operation ${operation.action === 'BLOCKED' ? 'blocked' : ''}">
    <div class="import-operation-heading"><span class="status-chip">${escapeHtml(operation.action)}</span><strong>${escapeHtml(operation.summary)}</strong>${operation.sourceAlias ? `<span class="mono">${escapeHtml(operation.sourceAlias)}</span>` : ''}</div>
    ${operation.changes.length ? `<div class="import-diff-list">${operation.changes.map(item => `<div class="import-diff"><span class="mono">${escapeHtml(item.path)}</span><span>${escapeHtml(importValue(item.oldValue))}</span><b>→</b><strong>${escapeHtml(importValue(item.newValue))}</strong></div>`).join('')}</div>` : '<div class="placeholder compact">No field changes.</div>'}
    ${operation.consequences.length ? `<ul class="import-consequences">${operation.consequences.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
  </section>`).join('');
  return `<div class="import-plan"><div class="import-plan-summary"><span>${escapeHtml(plan.kind.toUpperCase())}</span><strong>${plan.operations.length} operation${plan.operations.length === 1 ? '' : 's'}</strong><span>${plan.valid ? 'Ready to apply' : 'Blocked'}</span></div>${warning}${errors}${operations}<div class="placeholder compact mono">Plan ${escapeHtml(plan.id)} · expires ${escapeHtml(plan.expiresAt.slice(0,19))}</div></div>`;
}

function importValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function openPortableImport(surface: PortableImportSurface, targetId: string | null = null): void {
  state.notificationCenterOpen = false;
  state.notificationFilterOpen = false;
  state.importOpen = true;
  state.importSurface = surface;
  state.importTargetId = targetId;
  state.importText = '';
  state.importPlan = null;
  state.importError = null;
  state.importBusy = false;
  render();
  queueMicrotask(() => document.querySelector<HTMLTextAreaElement>('#portable-import-text')?.focus());
}

function togglePortableImport(surface: PortableImportSurface, targetId: string | null = null): void {
  if (state.importOpen && state.importSurface === surface && state.importTargetId === targetId) {
    closePortableImport();
    return;
  }
  openPortableImport(surface, targetId);
}

function closePortableImport(): void {
  state.importOpen = false;
  state.importSurface = null;
  state.importTargetId = null;
  state.importText = '';
  state.importPlan = null;
  state.importError = null;
  state.importBusy = false;
  render();
}

async function previewPortableImport(): Promise<void> {
  if (!state.importSurface) return;
  const textarea = document.querySelector<HTMLTextAreaElement>('#portable-import-text');
  state.importText = textarea?.value ?? state.importText;
  state.importBusy = true;
  state.importError = null;
  state.importPlan = null;
  render();
  try {
    state.importPlan = await api<PortableImportPlanView>('/api/import/preview', {
      method: 'POST',
      body: JSON.stringify({ document: state.importText, context: { surface: state.importSurface, targetId: state.importTargetId } })
    });
  } catch (error) {
    state.importError = message(error);
  } finally {
    state.importBusy = false;
    render();
  }
}

async function applyPortableImport(): Promise<void> {
  const plan = state.importPlan;
  if (!plan?.valid) return;
  state.importBusy = true;
  state.importError = null;
  render();
  try {
    const result = await api<PortableImportResultView>('/api/import/apply', {
      method: 'POST', body: JSON.stringify({ planId: plan.id, planHash: plan.planHash })
    });
    await refreshBootstrap();
    const surface = state.importSurface;
    if (surface?.startsWith('ENTITY')) {
      const nextId = result.createdIds.find(id => state.data?.entities.some(item => item.id === id)) ?? result.updatedIds.find(id => state.data?.entities.some(item => item.id === id)) ?? null;
      if (nextId) {
        state.selectedEntityId = nextId;
        touchRecent(nextId);
        persistEntityPreferences();
        updateUrlSelection();
      }
    } else if (surface?.startsWith('ARENA')) {
      const nextId = [...result.createdVersions, ...result.createdIds, ...result.updatedIds].find(id => state.data?.arenas.some(item => item.id === id)) ?? null;
      if (nextId) { state.selectedArenaId = nextId; state.selectedExperienceId = null; }
    }
    state.importOpen = false;
    state.importSurface = null;
    state.importTargetId = null;
    state.importPlan = null;
    state.importText = '';
    activateInspectorForSelection();
    const summary = `${result.createdIds.length} created, ${result.updatedIds.length} updated${result.createdVersions.length ? `, ${result.createdVersions.length} new version${result.createdVersions.length === 1 ? '' : 's'}` : ''}.`;
    void notifyUser('SUCCESS', 'Import applied', summary, 'import');
  } catch (error) {
    state.importError = message(error);
  } finally {
    state.importBusy = false;
    render();
  }
}

function positionOpenFlyouts(): void {
  if (state.entityFilterFlyout) {
    const trigger = document.querySelector<HTMLElement>(`[data-filter-column=\"${state.entityFilterFlyout.column}\"]`);
    const flyout = document.querySelector<HTMLElement>('.filter-flyout-portal');
    if (trigger && flyout) placeAnchoredFlyout(trigger, flyout);
  }
  const assetTrigger = document.querySelector<HTMLElement>('#live-asset-search');
  const assetFlyout = document.querySelector<HTMLElement>('.asset-search-flyout');
  if (assetTrigger && assetFlyout) placeAnchoredFlyout(assetTrigger, assetFlyout, { matchTriggerWidth: true });
}

function surfaceDock(): string {
  const active: ShellSurface = state.narrowSurface;
  const button = (surface: ShellSurface, label: string) => `<button class="surface-dock-tab ${active === surface ? 'active' : ''}" data-surface-target="${surface}" type="button" aria-pressed="${active === surface ? 'true' : 'false'}">${label}</button>`;
  return `<nav class="surface-dock surface-dock-${state.shellMode}" aria-label="Page surfaces">${button('OBJECTS', 'Objects')}${button('WORKSPACE', 'Workspace')}${button('INSPECTOR', 'Inspector')}</nav>`;
}

function surfaceHiddenAttributes(surface: ShellSurface): string {
  if (state.shellMode === 'desktop') return '';
  if (state.narrowSurface === surface) return '';
  return 'aria-hidden="true" inert';
}

function activateInspectorForSelection(): void {
  if (shouldSelectionOpenInspector(state.shellMode)) state.narrowSurface = 'INSPECTOR';
}

function rootFontPx(): number {
  const parsed = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

function scheduleShellModeUpdate(): void {
  if (shellResizeFrame !== null) cancelAnimationFrame(shellResizeFrame);
  shellResizeFrame = requestAnimationFrame(() => {
    shellResizeFrame = null;
    const next = deriveShellMode(document.documentElement.clientWidth || window.innerWidth, rootFontPx());
    const modeChanged = next !== state.shellMode;
    const transientChanged = Boolean(state.entityFilterFlyout);
    if (!modeChanged && !transientChanged) { positionOpenFlyouts(); return; }
    state.entityFilterFlyout = null;
    if (modeChanged) {
      state.shellMode = next;
      state.constrainedOverlay = null;
    }
    render();
  });
}

function renderPage(): { objects: string; workspace: string; inspector: string } {
  if (!state.data) throw new Error('Bootstrap data unavailable.');
  switch (state.page) {
    case 'LIVE':
      return renderLivePage({
        objects: state.liveObjects,
        activeSymbol: state.liveActiveSymbol,
        comparisonSymbols: state.liveComparisonSymbols,
        search: state.liveSearch,
        searchOpen: state.liveSearchOpen,
        searchLoading: state.liveSearchLoading,
        searchError: state.liveSearchError,
        searchResults: state.liveSearchResults,
        range: state.liveRange,
        mode: state.liveMode,
        compareEnabled: state.liveCompareEnabled,
        stockFeed: state.liveStockFeed,
        quote: state.liveQuote,
        chart: state.liveChart,
        compareSeries: state.liveCompareSeries,
        viewport: state.liveViewport,
        mouseDetails: state.liveMouseDetails,
        loading: state.liveLoading,
        error: state.liveError,
        inspectorContext: state.liveInspectorContext,
        provider: state.data.provider,
        auditIntegrity: state.data.auditIntegrity
      });
    case 'CONSOLE':
      return renderConsolePage({
        view: state.consoleView,
        overview: state.consoleOverview,
        logs: state.consoleLogs,
        auditEvents: state.consoleAuditEvents,
        loading: state.consoleLoading,
        error: state.consoleError,
        selectedLogIndex: state.consoleSelectedLogIndex,
        selectedAuditId: state.consoleSelectedAuditId,
        logSearch: state.consoleLogSearch,
        logLevel: state.consoleLogLevel
      });
    case 'ARENAS':
      return renderArenasPage({
        arenas: state.data.arenas,
        experiences: state.data.experiences,
        evaluationRuns: state.data.evaluationRuns,
        selectedArenaId: state.selectedArenaId,
        selectedExperienceId: state.selectedExperienceId,
        experienceDetail: state.experienceDetail,
        experienceLoading: state.experienceLoading,
        entities: state.data.entities,
        createMode: state.arenaCreateMode
      });
    case 'EVOLUTION':
      return renderEvolutionPage(
        state.data.evolutionRuns,
        state.data.entities.filter(entity => entity.lifecycleState === 'CANDIDATE' && entity.candidateStatus === 'ACTIVE'),
        state.selectedRunId
      );
    case 'BENCHMARK':
      return renderBenchmarkPage();
    case 'ENTITIES':
    default: {
      const rows = visibleEntityRows();
      const entityById = new Map(state.data.entities.map(entity => [entity.id, entity]));
      return renderEntitiesPage({
        rows,
        allEntityCount: state.data.counts.entities,
        selectedEntityId: state.selectedEntityId,
        search: state.entitySearch,
        searchDraft: state.entitySearchDraft,
        filters: state.entityFilters,
        sort: state.entitySort,
        filterFlyout: state.entityFilterFlyout,
        recentEntities: state.recentEntityIds.map(id => entityById.get(id)).filter((entity): entity is Entity => Boolean(entity)),
        pinnedEntities: state.pinnedEntityIds.map(id => entityById.get(id)).filter((entity): entity is Entity => Boolean(entity)),
        experienceCount: state.data.counts.experiences,
        snapshotCount: state.data.counts.snapshots,
        arenaCount: state.data.counts.arenas,
        arenas: state.data.arenas,
        saveState: state.entitySaveState,
        draftConfiguration: state.entityDraftConfiguration
      });
    }
  }
}

function nav(page: AppPage, label: string): string {
  return `<button class="nav-item ${state.page === page ? 'active' : ''}" data-page="${page}" type="button">${label}</button>`;
}

function wireEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(button => {
    button.addEventListener('click', () => navigate(button.dataset.page as AppPage));
  });

  document.querySelectorAll<HTMLButtonElement>('.surface-dock-tab[data-surface-target]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const surface = button.dataset.surfaceTarget as ShellSurface;
      if (state.shellMode === 'desktop' || state.narrowSurface === surface) return;
      state.narrowSurface = surface;
      state.constrainedOverlay = null;
      render();
    });
  });

  document.querySelector<HTMLButtonElement>('#probe-provider')?.addEventListener('click', async () => {
    try {
      await api('/api/provider/probe', { method: 'POST', body: '{}' });
      await refreshBootstrap();
      void notifyUser('INFO', 'Provider refreshed', 'Alpaca provider capabilities refreshed.', 'provider');
    } catch (error) {
      void notifyUser('ERROR', 'Provider refresh failed', message(error), 'provider');
    }
    render();
  });

  document.querySelector<HTMLButtonElement>('#notification-bell')?.addEventListener('click', event => {
    event.stopPropagation();
    const opening = !state.notificationCenterOpen;
    state.notificationCenterOpen = opening;
    state.notificationFilterOpen = false;
    if (opening) {
      state.importOpen = false;
      state.importSurface = null;
      state.importTargetId = null;
      state.importPlan = null;
      state.importError = null;
      expireToastSurface();
      void markAllNotificationsSeen();
    }
    render();
  });

  document.querySelector<HTMLButtonElement>('#notification-panel-close')?.addEventListener('click', () => {
    state.notificationCenterOpen = false;
    state.notificationFilterOpen = false;
    render();
  });

  document.querySelector<HTMLButtonElement>('#notification-filter-button')?.addEventListener('click', event => {
    event.stopPropagation();
    state.notificationFilterOpen = !state.notificationFilterOpen;
    render();
  });
  document.querySelector<HTMLSelectElement>('#notification-filter-condition')?.addEventListener('change', event => {
    state.notificationFilterDraftCondition = (event.currentTarget as HTMLSelectElement).value as NotificationFilterCondition;
    state.notificationFilterDraftValue = '';
    render();
    queueMicrotask(() => document.querySelector<HTMLElement>('#notification-filter-value')?.focus());
  });
  document.querySelector<HTMLInputElement | HTMLSelectElement>('#notification-filter-value')?.addEventListener('input', event => {
    state.notificationFilterDraftValue = (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;
  });
  document.querySelector<HTMLButtonElement>('#notification-filter-add')?.addEventListener('click', () => {
    const control = document.querySelector<HTMLInputElement | HTMLSelectElement>('#notification-filter-value');
    const value = control?.value.trim() ?? state.notificationFilterDraftValue.trim();
    if (!value) {
      void notifyUser('WARNING', 'Filter value required', 'Choose or enter a value before adding this filter.', 'notifications');
      return;
    }
    const rule: NotificationFilterRule = { condition: state.notificationFilterDraftCondition, value };
    if (!state.notificationFilters.some(item => item.condition === rule.condition && item.value.toLowerCase() === rule.value.toLowerCase())) {
      state.notificationFilters = [...state.notificationFilters, rule];
    }
    state.notificationFilterDraftValue = '';
    render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-remove-notification-filter]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const index = Number(button.dataset.removeNotificationFilter);
      if (!Number.isInteger(index)) return;
      state.notificationFilters = state.notificationFilters.filter((_, itemIndex) => itemIndex !== index);
      render();
    });
  });
  document.querySelector<HTMLButtonElement>('#notification-filter-clear-all')?.addEventListener('click', event => {
    event.stopPropagation();
    state.notificationFilters = [];
    render();
  });

  document.querySelector<HTMLButtonElement>('#notification-load-older')?.addEventListener('click', () => void loadOlderNotifications());

  document.querySelectorAll<HTMLButtonElement>('[data-notification-id]').forEach(button => button.addEventListener('click', () => openNotification(button.dataset.notificationId!)));
  document.querySelectorAll<HTMLDetailsElement>('[data-notification-group]').forEach(details => {
    details.addEventListener('toggle', () => {
      const key = details.dataset.notificationGroup;
      if (key) notificationGroupOpenState.set(key, details.open);
    });
  });

  document.querySelector<HTMLButtonElement>('#import-entity-objects')?.addEventListener('click', event => { event.stopPropagation(); togglePortableImport('ENTITY_OBJECTS'); });
  document.querySelector<HTMLButtonElement>('#entity-import-selected')?.addEventListener('click', event => { event.stopPropagation(); if (state.selectedEntityId) togglePortableImport('ENTITY_SELECTED', state.selectedEntityId); });
  document.querySelector<HTMLButtonElement>('#import-arena-objects')?.addEventListener('click', event => { event.stopPropagation(); state.arenaCreateMode = false; togglePortableImport('ARENA_OBJECTS'); });
  document.querySelector<HTMLButtonElement>('#new-arena')?.addEventListener('click', () => {
    state.arenaCreateMode = true;
    state.selectedExperienceId = null;
    state.experienceDetail = null;
    state.constrainedOverlay = null;
    if (state.shellMode !== 'desktop') state.narrowSurface = 'WORKSPACE';
    render();
    queueMicrotask(() => document.querySelector<HTMLInputElement>('#arena-name')?.focus());
  });
  document.querySelector<HTMLButtonElement>('#arena-import-selected')?.addEventListener('click', event => { event.stopPropagation(); if (state.selectedArenaId) togglePortableImport('ARENA_SELECTED', state.selectedArenaId); });
  document.querySelector<HTMLButtonElement>('#portable-import-close')?.addEventListener('click', closePortableImport);
  document.querySelector<HTMLButtonElement>('#portable-import-preview')?.addEventListener('click', () => void previewPortableImport());
  document.querySelector<HTMLButtonElement>('#portable-import-apply')?.addEventListener('click', () => void applyPortableImport());
  document.querySelector<HTMLTextAreaElement>('#portable-import-text')?.addEventListener('input', event => { state.importText = (event.currentTarget as HTMLTextAreaElement).value; });

  wireEntityEvents();
  wireLiveEvents();
  wireArenaEvents();
  wireEvolutionEvents();
  wireConsoleEvents();
}

function wireEntityEvents(): void {
  document.querySelector<HTMLButtonElement>('#new-entity')?.addEventListener('click', async () => {
    try {
      const entity = await api<Entity>('/api/entities', { method: 'POST', body: '{}' });
      state.entitySearch = '';
      state.entitySearchDraft = '';
      if (entitySearchTimer !== null) { window.clearTimeout(entitySearchTimer); entitySearchTimer = null; }
      state.entityFilters = { lifecycle: [{ operator: 'IS', value: 'CANDIDATE' }] };
      state.entityFilterFlyout = null;
      state.selectedEntityId = entity.id;
      touchRecent(entity.id);
      persistEntityPreferences();
      await refreshBootstrap();
      updateUrlSelection();
      activateInspectorForSelection();
      void notifyUser('SUCCESS', 'Entity created', `${entity.name} created.`, 'entity', { type: 'Entity', id: entity.id, route: `/entities?entity=${encodeURIComponent(entity.id)}` });
      render();
      queueMicrotask(() => document.querySelector<HTMLElement>(`[data-entity-id="${cssEscape(entity.id)}"]`)?.scrollIntoView({ block: 'nearest' }));
      return;
    } catch (error) {
      void notifyUser('ERROR', 'Action failed', message(error), 'application');
    }
    render();
  });

  document.querySelector<HTMLInputElement>('#entity-search')?.addEventListener('input', event => {
    const input = event.currentTarget as HTMLInputElement;
    state.entitySearchDraft = input.value;
    state.entityFilterFlyout = null;
    if (entitySearchTimer !== null) window.clearTimeout(entitySearchTimer);
    entitySearchTimer = window.setTimeout(() => {
      entitySearchTimer = null;
      state.entitySearch = state.entitySearchDraft;
      render();
      queueMicrotask(() => {
        const next = document.querySelector<HTMLInputElement>('#entity-search');
        const caret = next?.value.length ?? 0;
        next?.focus();
        next?.setSelectionRange(caret, caret);
      });
    }, 200);
  });

  document.querySelector<HTMLButtonElement>('#entity-search-clear')?.addEventListener('click', () => {
    if (entitySearchTimer !== null) { window.clearTimeout(entitySearchTimer); entitySearchTimer = null; }
    state.entitySearchDraft = '';
    state.entitySearch = '';
    state.entityFilterFlyout = null;
    render();
    queueMicrotask(() => document.querySelector<HTMLInputElement>('#entity-search')?.focus());
  });

  document.querySelectorAll<HTMLButtonElement>('[data-sort-column]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const column = button.dataset.sortColumn as EntityColumnKey;
      state.entitySort = state.entitySort?.column === column
        ? { column, direction: state.entitySort.direction === 'ASC' ? 'DESC' : 'ASC' }
        : { column, direction: 'ASC' };
      persistEntityPreferences();
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-filter-column]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const column = button.dataset.filterColumn as EntityColumnKey;
      if (state.entityFilterFlyout?.column === column) {
        state.entityFilterFlyout = null;
      } else {
        const rect = button.getBoundingClientRect();
        const workspace = document.querySelector<HTMLElement>('.workspace')?.getBoundingClientRect();
        const width = 272;
        const minLeft = (workspace?.left ?? 0) + 6;
        const maxLeft = Math.max(minLeft, window.innerWidth - width - 8);
        let left = rect.right - width;
        if (left < minLeft) left = rect.left;
        left = Math.max(minLeft, Math.min(maxLeft, left));
        state.entityFilterFlyout = { column, operator: operatorsFor(column)[0]!, left, top: rect.bottom + 6 };
      }
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-remove-filter-rule]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const column = button.dataset.removeFilterRule as EntityColumnKey;
      const index = Number(button.dataset.filterRuleIndex);
      if (!Number.isInteger(index)) return;
      const rules = [...(state.entityFilters[column] ?? [])];
      rules.splice(index, 1);
      const next = { ...state.entityFilters };
      if (rules.length) next[column] = rules;
      else delete next[column];
      state.entityFilters = next;
      persistEntityPreferences();
      normalizeSelectedEntityToVisible();
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-clear-filter]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const column = button.dataset.clearFilter as EntityColumnKey;
      const next = { ...state.entityFilters };
      delete next[column];
      state.entityFilters = next;
      persistEntityPreferences();
      normalizeSelectedEntityToVisible();
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-apply-filter]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const column = button.dataset.applyFilter as EntityColumnKey;
      const condition = document.querySelector<HTMLSelectElement>(`#filter-condition-${column}`);
      const operator = condition?.value as EntityFilterOperator;
      const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#filter-value-${column}`);
      const value = input?.value.trim() ?? '';
      if (!value) {
        void notifyUser('WARNING', 'Filter value required', 'Enter a value before adding this filter.', 'entities');
        return;
      }
      const rule = { operator, value } satisfies EntityColumnFilter;
      const rules = state.entityFilters[column] ?? [];
      const exists = rules.some(item => item.operator === rule.operator && item.value.toLowerCase() === rule.value.toLowerCase());
      state.entityFilters = { ...state.entityFilters, [column]: exists ? rules : [...rules, rule] };
      state.entityFilterFlyout = { ...state.entityFilterFlyout!, operator };
      persistEntityPreferences();
      normalizeSelectedEntityToVisible();
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-entity-id]').forEach(row => wireEntitySelection(row, false));
  document.querySelectorAll<HTMLElement>('[data-entity-object-id]').forEach(row => wireEntitySelection(row, true));

  document.querySelectorAll<HTMLButtonElement>('[data-pin-entity-id]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      togglePin(button.dataset.pinEntityId!);
    });
  });
  document.querySelector<HTMLButtonElement>('#inspector-pin-entity')?.addEventListener('click', () => {
    if (state.selectedEntityId) togglePin(state.selectedEntityId);
  });
  document.querySelector<HTMLButtonElement>('#entity-lifecycle-action')?.addEventListener('click', event => {
    if (!state.selectedEntityId) return;
    const action = (event.currentTarget as HTMLButtonElement).dataset.entityLifecycleAction as EntityLifecycleActionId | undefined;
    if (action) requestEntityLifecycleAction(state.selectedEntityId, action);
  });
  document.querySelector<HTMLButtonElement>('#entity-save-draft-configuration')?.addEventListener('click', () => void saveSelectedEntityDraftConfiguration());
  document.querySelector<HTMLButtonElement>('#entity-finalize-configuration')?.addEventListener('click', () => void finalizeSelectedEntityConfiguration());
  document.querySelector<HTMLButtonElement>('#entity-evaluate')?.addEventListener('click', () => void evaluateSelectedEntity());
  document.querySelector<HTMLButtonElement>('[data-entity-context-pin]')?.addEventListener('click', event => {
    const id = (event.currentTarget as HTMLButtonElement).dataset.entityContextPin;
    if (!id) return;
    state.entityContextMenu = null;
    togglePin(id);
  });
  document.querySelector<HTMLButtonElement>('[data-entity-context-lifecycle]')?.addEventListener('click', event => {
    const button = event.currentTarget as HTMLButtonElement;
    const id = button.dataset.contextEntityId;
    const action = button.dataset.entityContextLifecycle as EntityLifecycleActionId | undefined;
    if (id && action) requestEntityLifecycleAction(id, action);
  });
  document.querySelector<HTMLButtonElement>('#entity-confirm-cancel')?.addEventListener('click', () => {
    state.entityLifecycleConfirm = null;
    render();
  });
  document.querySelector<HTMLButtonElement>('#entity-confirm-submit')?.addEventListener('click', () => void executeEntityLifecycleAction());

  const nameInput = document.querySelector<HTMLInputElement>('#entity-name-input');
  const familyInput = document.querySelector<HTMLInputElement>('#entity-family-input');
  if (nameInput) wireEditableInput(nameInput, 'name');
  if (familyInput) wireEditableInput(familyInput, 'family');
}

function wireEntitySelection(row: HTMLElement, reveal: boolean): void {
  const select = () => {
    const id = row.dataset.entityId ?? row.dataset.entityObjectId ?? null;
    if (!id) return;
    if (reveal) revealEntity(id);
    else {
      state.selectedEntityId = id;
      touchRecent(id);
    }
    state.entitySaveState = null;
    if (state.entityDraftConfiguration?.entityId !== id) state.entityDraftConfiguration = null;
    state.entityFilterFlyout = null;
    persistEntityPreferences();
    updateUrlSelection();
    activateInspectorForSelection();
    render();
  };
  row.addEventListener('click', select);
  row.addEventListener('contextmenu', event => {
    event.preventDefault();
    event.stopPropagation();
    const id = row.dataset.entityId ?? row.dataset.entityObjectId ?? null;
    if (id) openEntityContextMenu(id, event.clientX, event.clientY);
  });
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const id = row.dataset.entityId ?? row.dataset.entityObjectId ?? null;
      if (!id) return;
      const rect = row.getBoundingClientRect();
      openEntityContextMenu(id, rect.left + Math.min(rect.width, 180), rect.top + Math.min(rect.height, 28));
    }
  });
}

function revealEntity(id: string): void {
  const entity = state.data?.entities.find(item => item.id === id);
  if (!entity) return;
  state.selectedEntityId = id;
  touchRecent(id);
}

function togglePin(id: string): void {
  state.pinnedEntityIds = state.pinnedEntityIds.includes(id)
    ? state.pinnedEntityIds.filter(value => value !== id)
    : [id, ...state.pinnedEntityIds.filter(value => value !== id)];
  persistEntityPreferences();
  render();
}

function openEntityContextMenu(entityId: string, clientX: number, clientY: number): void {
  const entity = state.data?.entities.find(item => item.id === entityId);
  if (!entity) return;
  state.selectedEntityId = entityId;
  touchRecent(entityId);
  state.entityFilterFlyout = null;
  state.entityContextMenu = {
    entityId,
    left: Math.max(8, Math.min(clientX, window.innerWidth - (14 * rootFontPx()) - 8)),
    top: Math.max(8, Math.min(clientY, window.innerHeight - (9 * rootFontPx()) - 8))
  };
  persistEntityPreferences();
  updateUrlSelection();
  render();
}

function renderEntityContextMenu(): string {
  const menu = state.entityContextMenu;
  if (!menu) return '';
  const entity = state.data?.entities.find(item => item.id === menu.entityId);
  if (!entity) return '';
  const pinned = state.pinnedEntityIds.includes(entity.id);
  const lifecycleAction = lifecycleActionForEntity(entity);
  return `<div class="context-menu entity-context-menu" style="left:${Math.round(menu.left)}px;top:${Math.round(menu.top)}px" role="menu" aria-label="${escapeHtml(entity.name)} options">
    <div class="context-menu-title"><strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.lifecycleState)} · ${escapeHtml(entity.id)}</span></div>
    <button data-entity-context-pin="${escapeHtml(entity.id)}" type="button" role="menuitem">${pinned ? 'Unpin' : 'Pin'}</button>
    <div class="context-menu-separator" aria-hidden="true"></div>
    <button class="danger" data-entity-context-lifecycle="${lifecycleAction.id}" data-context-entity-id="${escapeHtml(entity.id)}" type="button" role="menuitem">${lifecycleAction.label}</button>
  </div>`;
}

function requestEntityLifecycleAction(entityId: string, action: EntityLifecycleActionId): void {
  const entity = state.data?.entities.find(item => item.id === entityId);
  if (!entity) return;
  const expected = lifecycleActionForEntity(entity).id;
  if (action !== expected) return;
  state.entityContextMenu = null;
  state.entityLifecycleConfirm = { entityId, action };
  render();
  queueMicrotask(() => document.querySelector<HTMLButtonElement>('#entity-confirm-cancel')?.focus());
}

function renderEntityLifecycleModal(): string {
  const confirm = state.entityLifecycleConfirm;
  if (!confirm) return '';
  const entity = state.data?.entities.find(item => item.id === confirm.entityId);
  if (!entity) return '';
  const deleting = confirm.action === 'DELETE';
  const title = deleting ? `Delete ${entity.name}?` : `Retire ${entity.name}?`;
  const body = deleting
    ? 'This removes the retired Entity from the working population. Historical research, lineage, and audit identity remain preserved by an immutable tombstone. This action cannot be undone.'
    : 'This removes the Entity from active research use while preserving it and its historical evidence. A retired Entity may later be deleted from the working population.';
  return `<div class="modal-backdrop" role="presentation">
    <section class="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="entity-confirm-title" aria-describedby="entity-confirm-body">
      <div class="eyebrow">${deleting ? 'Permanent removal' : 'Lifecycle change'}</div>
      <h2 id="entity-confirm-title">${escapeHtml(title)}</h2>
      <p id="entity-confirm-body">${escapeHtml(body)}</p>
      <div class="modal-actions">
        <button id="entity-confirm-cancel" class="button" type="button">Cancel</button>
        <button id="entity-confirm-submit" class="button danger" type="button">${deleting ? 'Delete Entity' : 'Retire Entity'}</button>
      </div>
    </section>
  </div>`;
}

async function executeEntityLifecycleAction(): Promise<void> {
  const confirm = state.entityLifecycleConfirm;
  if (!confirm) return;
  const entity = state.data?.entities.find(item => item.id === confirm.entityId);
  if (!entity) { state.entityLifecycleConfirm = null; render(); return; }
  try {
    if (confirm.action === 'RETIRE') {
      const retired = await api<Entity>(`/api/entities/${encodeURIComponent(entity.id)}/retire`, { method: 'POST', body: '{}' });
      state.entityLifecycleConfirm = null;
      await refreshBootstrap();
      state.selectedEntityId = retired.id;
      touchRecent(retired.id);
      persistEntityPreferences();
      updateUrlSelection();
      activateInspectorForSelection();
      void notifyUser('SUCCESS', 'Entity retired', `${retired.name} retired.`, 'entity', { type: 'Entity', id: retired.id, route: `/entities?entity=${encodeURIComponent(retired.id)}` });
      render();
      return;
    }

    const deletedName = entity.name;
    await api<{ deletedId: string }>(`/api/entities/${encodeURIComponent(entity.id)}`, { method: 'DELETE' });
    state.entityLifecycleConfirm = null;
    state.recentEntityIds = state.recentEntityIds.filter(id => id !== entity.id);
    state.pinnedEntityIds = state.pinnedEntityIds.filter(id => id !== entity.id);
    persistEntityPreferences();
    await refreshBootstrap();
    state.selectedEntityId = null;
    updateUrlSelection();
    void notifyUser('SUCCESS', 'Entity deleted', `${deletedName} removed from the working population.`, 'entity');
    render();
  } catch (error) {
    state.entityLifecycleConfirm = null;
    void notifyUser('ERROR', 'Entity action failed', message(error), 'entity');
    await refreshBootstrap().catch(() => undefined);
    render();
  }
}


function selectedEntityDraftConfiguration(): EntityDraftConfigurationView | null {
  const entityId = state.selectedEntityId;
  if (!entityId) return null;
  return {
    entityId,
    strategyType: document.querySelector<HTMLSelectElement>('#entity-strategy-type')?.value ?? 'MOVING_AVERAGE_CROSS',
    traits: {
      fast_window: Number(document.querySelector<HTMLInputElement>('#entity-trait-fast')?.value ?? '10'),
      slow_window: Number(document.querySelector<HTMLInputElement>('#entity-trait-slow')?.value ?? '30'),
      target_exposure: Number(document.querySelector<HTMLInputElement>('#entity-trait-exposure')?.value ?? '1')
    }
  };
}

async function saveSelectedEntityDraftConfiguration(): Promise<void> {
  const draft = selectedEntityDraftConfiguration();
  if (!draft) return;
  state.entityDraftConfiguration = draft;
  try {
    const entity = await api<Entity>(`/api/entities/${encodeURIComponent(draft.entityId)}/configuration`, {
      method: 'PATCH',
      body: JSON.stringify({ strategyType: draft.strategyType, traits: draft.traits })
    });
    await refreshBootstrap();
    state.selectedEntityId = entity.id;
    state.entityDraftConfiguration = null;
    void notifyUser('SUCCESS', 'Draft saved', `${entity.name} strategy draft saved.`, 'entity');
  } catch (error) {
    void notifyUser('ERROR', 'Draft save failed', message(error), 'entity');
  }
  render();
}

async function finalizeSelectedEntityConfiguration(): Promise<void> {
  const draft = selectedEntityDraftConfiguration();
  if (!draft) return;
  state.entityDraftConfiguration = draft;
  try {
    const entity = await api<Entity>(`/api/entities/${encodeURIComponent(draft.entityId)}/configuration/finalize`, {
      method: 'POST',
      body: JSON.stringify({ strategyType: draft.strategyType, traits: draft.traits })
    });
    await refreshBootstrap();
    state.selectedEntityId = entity.id;
    state.entityDraftConfiguration = null;
    void notifyUser('SUCCESS', 'Entity ready', `${entity.name} birth strategy and traits are now immutable.`, 'entity', { type: 'Entity', id: entity.id, route: `/entities?entity=${encodeURIComponent(entity.id)}` });
  } catch (error) {
    void notifyUser('ERROR', 'Configuration failed', message(error), 'entity');
  }
  render();
}

async function evaluateSelectedEntity(): Promise<void> {
  const entityId = state.selectedEntityId;
  const arenaId = document.querySelector<HTMLSelectElement>('#entity-evaluate-arena')?.value ?? '';
  if (!entityId || !arenaId) return;
  await runEvaluation(entityId, arenaId, document.querySelector<HTMLButtonElement>('#entity-evaluate'));
}

async function evaluateSelectedArena(): Promise<void> {
  const arenaId = state.selectedArenaId;
  const entityId = document.querySelector<HTMLSelectElement>('#arena-evaluate-entity')?.value ?? '';
  if (!entityId || !arenaId) return;
  await runEvaluation(entityId, arenaId, document.querySelector<HTMLButtonElement>('#arena-run-evaluation'));
}

async function runEvaluation(entityId: string, arenaId: string, button: HTMLButtonElement | null): Promise<void> {
  if (button) { button.disabled = true; button.textContent = 'Running…'; }
  try {
    const result = await api<{ experience: Experience }>(`/api/evaluations`, {
      method: 'POST',
      body: JSON.stringify({ entityId, arenaId })
    });
    await refreshBootstrap();
    state.page = 'ARENAS';
    state.selectedArenaId = arenaId;
    state.selectedExperienceId = result.experience.id;
    state.experienceDetail = null;
    history.pushState({}, '', '/arenas');
    void notifyUser('SUCCESS', 'Evaluation completed', `Experience ${result.experience.id} completed with Reward ${typeof result.experience.reward === 'number' ? result.experience.reward.toFixed(4) : '—'}.`, 'experience', { type: 'Experience', id: result.experience.id, route: '/arenas' });
    await selectExperience(result.experience.id);
    return;
  } catch (error) {
    void notifyUser('ERROR', 'Evaluation failed', message(error), 'evaluation');
  }
  render();
}

function touchRecent(id: string): void {
  state.recentEntityIds = [id, ...state.recentEntityIds.filter(value => value !== id)].slice(0, 10);
}

function normalizeSelectedEntityToVisible(): void {
  const visible = visibleEntityRows();
  if (!visible.some(row => row.entity.id === state.selectedEntityId)) state.selectedEntityId = visible[0]?.entity.id ?? null;
  updateUrlSelection();
}

function wireEditableInput(input: HTMLInputElement, field: 'name' | 'family'): void {
  const original = input.value;
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') input.blur();
    if (event.key === 'Escape') {
      input.value = original;
      input.blur();
    }
  });
  input.addEventListener('change', async () => {
    if (!state.selectedEntityId) return;
    state.entitySaveState = 'Saving…';
    renderSaveStateOnly();
    try {
      const body = field === 'family' ? { family: input.value.trim() || null } : { name: input.value };
      await api<Entity>(`/api/entities/${encodeURIComponent(state.selectedEntityId)}`, { method: 'PATCH', body: JSON.stringify(body) });
      await refreshBootstrap();
      state.entitySaveState = 'Saved';
    } catch (error) {
      state.entitySaveState = `Error: ${message(error)}`;
    }
    render();
  });
}

function renderSaveStateOnly(): void {
  const node = document.querySelector<HTMLElement>('.field-save-state');
  if (node) node.textContent = state.entitySaveState ?? '';
}

function wireLiveEvents(): void {
  const search = document.querySelector<HTMLInputElement>('#live-asset-search');
  search?.addEventListener('focus', () => {
    // Only trigger a fresh search on the transition from closed -> open. Every render()
    // recreates this input node (full-DOM re-render architecture) and searchAssets()
    // programmatically re-focuses it afterward to preserve the user's typing position;
    // that programmatic focus() dispatches a genuine 'focus' event on the new node. If
    // this handler unconditionally rescheduled a search on every focus event, that would
    // create an infinite render -> focus -> search -> render loop (see 1.3.2 rescue notes).
    if (!state.liveSearchOpen) {
      state.liveSearchOpen = true;
      render();
      queueMicrotask(() => document.querySelector<HTMLInputElement>('#live-asset-search')?.focus());
      scheduleAssetSearch(0);
    }
  });
  search?.addEventListener('input', event => {
    state.liveSearch = (event.currentTarget as HTMLInputElement).value;
    state.liveSearchOpen = true;
    scheduleAssetSearch(180);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-add-market-symbol]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const symbol = button.dataset.addMarketSymbol!;
      const assetClass = button.dataset.assetClass as MarketAssetClass;
      addLiveObject({
        symbol,
        name: button.dataset.assetName || symbol,
        assetClass,
        exchange: button.dataset.assetExchange || null,
        tradable: true,
        status: 'active'
      });
    });
  });

  document.querySelectorAll<HTMLElement>('[data-live-symbol]').forEach(row => {
    const select = () => {
      const symbol = row.dataset.liveSymbol!;
      if (state.liveActiveSymbol === symbol) {
        if (state.liveInspectorContext !== 'SYMBOL') {
          state.liveInspectorContext = 'SYMBOL';
          activateInspectorForSelection();
          render();
        }
        return;
      }
      state.liveActiveSymbol = symbol;
      state.liveInspectorContext = 'SYMBOL';
      activateInspectorForSelection();
      state.liveSearchOpen = false;
      state.liveViewport = { ...FULL_VIEWPORT };
      state.liveMouseDetails = null;
      persistLivePreferences();
      updateLiveUrl();
      render();
      void refreshLiveData();
    };
    row.addEventListener('click', select);
    row.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      openLiveContextMenu(row.dataset.liveSymbol!, event.clientX, event.clientY);
    });
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        const rect = row.getBoundingClientRect();
        openLiveContextMenu(row.dataset.liveSymbol!, rect.left + Math.min(rect.width, 160), rect.top + Math.min(rect.height, 24));
      }
    });
  });

  document.querySelector<HTMLButtonElement>('[data-remove-live-symbol]')?.addEventListener('click', event => {
    event.stopPropagation();
    const symbol = (event.currentTarget as HTMLButtonElement).dataset.removeLiveSymbol;
    if (symbol) removeLiveObject(symbol);
  });

  document.querySelectorAll<HTMLElement>('[data-compare-check-label]').forEach(label => {
    label.addEventListener('click', event => event.stopPropagation());
  });
  document.querySelectorAll<HTMLInputElement>('[data-compare-symbol]').forEach(checkbox => {
    checkbox.addEventListener('click', event => event.stopPropagation());
    checkbox.addEventListener('change', event => {
      event.stopPropagation();
      toggleLiveComparisonSymbol(checkbox.dataset.compareSymbol!, checkbox.checked);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-live-range]').forEach(button => {
    button.addEventListener('click', () => setLiveRange(button.dataset.liveRange as LiveRange));
  });
  document.querySelector<HTMLSelectElement>('#live-chart-presentation')?.addEventListener('change', event => setLivePresentation((event.currentTarget as HTMLSelectElement).value));
  document.querySelector<HTMLButtonElement>('#live-chart-title')?.addEventListener('click', () => {
    if (state.liveInspectorContext === 'CHART') return;
    state.liveInspectorContext = 'CHART';
    activateInspectorForSelection();
    render();
  });
  document.querySelector<HTMLSelectElement>('#inspector-live-range')?.addEventListener('change', event => setLiveRange((event.currentTarget as HTMLSelectElement).value as LiveRange));
  document.querySelector<HTMLSelectElement>('#inspector-live-presentation')?.addEventListener('change', event => setLivePresentation((event.currentTarget as HTMLSelectElement).value));
  document.querySelector<HTMLSelectElement>('#inspector-live-feed')?.addEventListener('change', event => {
    const next = (event.currentTarget as HTMLSelectElement).value;
    if (state.liveStockFeed === next) return;
    state.liveStockFeed = next;
    state.liveViewport = { ...FULL_VIEWPORT };
    state.liveMouseDetails = null;
    persistLivePreferences();
    void refreshLiveData();
  });
  document.querySelector<HTMLButtonElement>('#live-refresh-data')?.addEventListener('click', () => void refreshLiveData());
  document.querySelector<HTMLButtonElement>('#live-inspector-remove')?.addEventListener('click', () => {
    if (state.liveActiveSymbol) removeLiveObject(state.liveActiveSymbol);
  });

  document.querySelector<HTMLButtonElement>('#live-inspector-compare')?.addEventListener('click', () => {
    const asset = activeLiveAsset();
    if (!asset) return;
    toggleLiveComparisonSymbol(asset.symbol, !state.liveComparisonSymbols.includes(asset.symbol));
  });
  document.querySelector<HTMLButtonElement>('#export-diagnostics')?.addEventListener('click', () => void exportDiagnostics());
  wireChartInteraction();
}

function scheduleAssetSearch(delay: number): void {
  if (assetSearchTimer !== null) window.clearTimeout(assetSearchTimer);
  assetSearchTimer = window.setTimeout(() => void searchAssets(), delay);
}

async function searchAssets(): Promise<void> {
  const query = state.liveSearch;
  state.liveSearchLoading = true;
  state.liveSearchError = null;
  try {
    const result = await api<AssetSearchView>(`/api/market/assets?query=${encodeURIComponent(query)}&assetClass=ALL&limit=50`);
    if (query !== state.liveSearch) return;
    state.liveSearchResults = result.assets;
  } catch (error) {
    state.liveSearchResults = [];
    state.liveSearchError = message(error);
  } finally {
    if (query === state.liveSearch) {
      state.liveSearchLoading = false;
      render();
      if (state.liveSearchOpen) {
        queueMicrotask(() => {
          const next = document.querySelector<HTMLInputElement>('#live-asset-search');
          if (!next) return;
          next.focus();
          const caret = next.value.length;
          next.setSelectionRange(caret, caret);
        });
      }
    }
  }
}

function openLiveContextMenu(symbol: string, clientX: number, clientY: number): void {
  const width = 13 * rootFontPx();
  const height = 5.5 * rootFontPx();
  state.liveContextMenu = {
    symbol,
    left: Math.max(8, Math.min(clientX, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(clientY, window.innerHeight - height - 8))
  };
  render();
}

function renderLiveContextMenu(): string {
  const menu = state.liveContextMenu;
  if (!menu) return '';
  const asset = state.liveObjects.find(item => item.symbol === menu.symbol);
  if (!asset) return '';
  return `<div class="context-menu live-context-menu" style="left:${Math.round(menu.left)}px;top:${Math.round(menu.top)}px" role="menu" aria-label="${escapeHtml(asset.symbol)} options">
    <div class="context-menu-title"><strong>${escapeHtml(asset.symbol)}</strong><span>${escapeHtml(asset.name)}</span></div>
    <button data-remove-live-symbol="${escapeHtml(asset.symbol)}" type="button" role="menuitem">Remove from watchlist</button>
  </div>`;
}

function removeLiveObject(symbol: string): void {
  const index = state.liveObjects.findIndex(item => item.symbol === symbol);
  if (index < 0) return;
  const remaining = state.liveObjects.filter(item => item.symbol !== symbol);
  state.liveObjects = remaining;
  state.liveComparisonSymbols = state.liveComparisonSymbols.filter(item => item !== symbol);
  state.liveContextMenu = null;
  if (state.liveActiveSymbol === symbol) {
    const fallback = remaining[Math.min(index, Math.max(0, remaining.length - 1))] ?? null;
    state.liveActiveSymbol = fallback?.symbol ?? '';
    state.liveQuote = null;
    state.liveChart = null;
    state.liveCompareSeries = [];
    state.liveViewport = { ...FULL_VIEWPORT };
    state.liveMouseDetails = null;
    state.liveInspectorContext = 'SYMBOL';
  }
  persistLivePreferences();
  updateLiveUrl();
  render();
  if (state.liveActiveSymbol) void refreshLiveData();
}

function addLiveObject(asset: MarketAsset): void {
  if (!state.liveObjects.some(item => item.symbol === asset.symbol)) state.liveObjects = [...state.liveObjects, asset];
  state.liveActiveSymbol = asset.symbol;
  state.liveInspectorContext = 'SYMBOL';
  activateInspectorForSelection();
  state.liveViewport = { ...FULL_VIEWPORT };
  state.liveMouseDetails = null;
  state.liveSearch = '';
  state.liveSearchOpen = false;
  state.liveSearchResults = [];
  persistLivePreferences();
  updateLiveUrl();
  render();
  void refreshLiveData();
}

function activeLiveAsset(): MarketAsset | null {
  return state.liveObjects.find(asset => asset.symbol === state.liveActiveSymbol) ?? null;
}

async function refreshLiveData(): Promise<void> {
  const asset = activeLiveAsset();
  if (!asset) return;
  const token = ++state.liveRequestToken;
  state.liveLoading = true;
  state.liveError = null;
  render();
  const feed = asset.assetClass === 'CRYPTO' ? 'crypto_us' : state.liveStockFeed;
  try {
    const [quote, chart] = await Promise.all([
      api<LiveQuoteView>(`/api/market/quote?symbol=${encodeURIComponent(asset.symbol)}&assetClass=${asset.assetClass}&feed=${encodeURIComponent(feed)}`),
      api<LiveChartView>(`/api/market/chart?symbol=${encodeURIComponent(asset.symbol)}&assetClass=${asset.assetClass}&range=${state.liveRange}&feed=${encodeURIComponent(feed)}`)
    ]);
    if (token !== state.liveRequestToken) return;
    state.liveQuote = quote;
    state.liveChart = chart;
    if (state.liveCompareEnabled) await refreshCompareSeries(token);
  } catch (error) {
    if (token !== state.liveRequestToken) return;
    state.liveQuote = null;
    state.liveChart = null;
    state.liveCompareSeries = [];
    state.liveError = message(error);
  } finally {
    if (token === state.liveRequestToken) {
      state.liveLoading = false;
      render();
    }
  }
}

async function refreshCompareSeries(parentToken?: number): Promise<void> {
  const token = parentToken ?? ++state.liveRequestToken;
  const selected = state.liveObjects.filter(asset => state.liveComparisonSymbols.includes(asset.symbol));
  if (!selected.length) {
    state.liveCompareSeries = [];
    state.liveLoading = false;
    render();
    return;
  }
  if (parentToken === undefined) {
    state.liveLoading = true;
    state.liveError = null;
    render();
  }
  try {
    const series = await Promise.all(selected.map(async asset => {
      if (state.liveChart?.symbol === asset.symbol && state.liveChart.range === state.liveRange) return { symbol: asset.symbol, chart: state.liveChart };
      const feed = asset.assetClass === 'CRYPTO' ? 'crypto_us' : state.liveStockFeed;
      const chart = await api<LiveChartView>(`/api/market/chart?symbol=${encodeURIComponent(asset.symbol)}&assetClass=${asset.assetClass}&range=${state.liveRange}&feed=${encodeURIComponent(feed)}`);
      return { symbol: asset.symbol, chart };
    }));
    if (token !== state.liveRequestToken) return;
    state.liveCompareSeries = series;
  } catch (error) {
    if (token !== state.liveRequestToken) return;
    state.liveCompareSeries = [];
    state.liveError = message(error);
  } finally {
    if (parentToken === undefined && token === state.liveRequestToken) {
      state.liveLoading = false;
      render();
    }
  }
}

function setLiveRange(range: LiveRange): void {
  if (state.liveRange === range) return;
  state.liveRange = range;
  state.liveViewport = { ...FULL_VIEWPORT };
  state.liveMouseDetails = null;
  persistLivePreferences();
  void refreshLiveData();
}

function setLivePresentation(value: string): void {
  if (value === 'COMPARE') {
    if (state.liveCompareEnabled) return;
    state.liveCompareEnabled = true;
    state.liveViewport = { ...FULL_VIEWPORT };
    state.liveMouseDetails = null;
    persistLivePreferences();
    render();
    void refreshCompareSeries();
    return;
  }
  if (value !== 'CANDLES_VOLUME' && value !== 'CANDLES' && value !== 'LINE') return;
  const mode = value as LiveChartMode;
  if (!state.liveCompareEnabled && state.liveMode === mode) return;
  state.liveCompareEnabled = false;
  state.liveMode = mode;
  state.liveViewport = { ...FULL_VIEWPORT };
  state.liveMouseDetails = null;
  persistLivePreferences();
  render();
}

function toggleLiveComparisonSymbol(symbol: string, included: boolean): void {
  state.liveComparisonSymbols = included
    ? [...new Set([...state.liveComparisonSymbols, symbol])]
    : state.liveComparisonSymbols.filter(value => value !== symbol);
  persistLivePreferences();
  render();
  if (state.liveCompareEnabled) void refreshCompareSeries();
}

function wireChartInteraction(): void {
  const frame = document.querySelector<HTMLElement>('#market-chart-frame');
  if (!frame) return;
  const vertical = document.querySelector<HTMLElement>('#chart-crosshair-v');
  const horizontal = document.querySelector<HTMLElement>('#chart-crosshair-h');
  const hover = document.querySelector<HTMLElement>('#chart-hover');
  if (!vertical || !horizontal || !hover) return;

  requestAnimationFrame(() => layoutChartTimeLabels(frame));
  if (typeof ResizeObserver !== 'undefined') {
    const axisResizeObserver = new ResizeObserver(() => layoutChartTimeLabels(frame));
    axisResizeObserver.observe(frame);
  }

  frame.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = frame.getBoundingClientRect();
    const center = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    state.liveViewport = zoomViewport(state.liveViewport, center, event.deltaY < 0 ? 0.78 : 1.28);
    render();
  }, { passive: false });

  frame.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = frame.getBoundingClientRect();
    const startX = event.clientX;
    const startViewport = { ...state.liveViewport };
    const span = startViewport.end - startViewport.start;
    frame.classList.add('dragging');
    const move = (moveEvent: PointerEvent) => {
      const delta = -((moveEvent.clientX - startX) / Math.max(1, rect.width)) * span;
      state.liveViewport = panViewport(startViewport, delta);
      render();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.querySelector<HTMLElement>('#market-chart-frame')?.classList.remove('dragging');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  });

  frame.addEventListener('pointermove', event => {
    const rect = frame.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    const point = state.liveCompareEnabled
      ? compareHoverPoint(state.liveCompareSeries, state.liveViewport, xRatio, yRatio)
      : state.liveChart ? singleHoverPoint(state.liveChart, state.liveMode, state.liveViewport, xRatio) : null;
    if (!point) return;
    state.liveMouseDetails = point.details;
    vertical.hidden = false;
    horizontal.hidden = false;
    hover.hidden = false;
    vertical.style.left = `${point.xRatio * rect.width}px`;
    horizontal.style.top = `${point.yRatio * rect.height}px`;
    hover.textContent = mouseDetailsText(point.details);
    const left = Math.min(Math.max(8, point.xRatio * rect.width + 12), Math.max(8, rect.width - 300));
    const top = Math.max(8, point.yRatio * rect.height - 38);
    hover.style.left = `${left}px`;
    hover.style.top = `${top}px`;
    updateMouseDetailsInspector(point.details);
  });

  frame.addEventListener('pointerleave', () => {
    vertical.hidden = true;
    horizontal.hidden = true;
    hover.hidden = true;
  });
}

function layoutChartTimeLabels(frame: HTMLElement): void {
  const labels = Array.from(frame.querySelectorAll<HTMLElement>('[data-chart-time-label]'));
  if (labels.length <= 1) return;
  for (const label of labels) label.hidden = false;

  const gap = 12;
  let previousRight = Number.NEGATIVE_INFINITY;
  for (const label of labels) {
    const rect = label.getBoundingClientRect();
    if (rect.left < previousRight + gap) {
      label.hidden = true;
      continue;
    }
    previousRight = rect.right;
  }
}

function updateMouseDetailsInspector(details: LiveMouseDetails): void {
  const values: Record<string, string> = {
    'live-mouse-time': details.time,
    'live-mouse-open': details.open ?? '—',
    'live-mouse-high': details.high ?? '—',
    'live-mouse-low': details.low ?? '—',
    'live-mouse-close': details.close ?? '—',
    'live-mouse-volume': details.values ?? details.volume ?? '—'
  };
  for (const [id, value] of Object.entries(values)) {
    const node = document.querySelector<HTMLElement>(`#${id}`);
    if (node) node.textContent = value;
  }
}

function mouseDetailsText(details: LiveMouseDetails): string {
  if (details.kind === 'COMPARE') return `${details.time}  ${details.values ?? ''}`;
  return `${details.time}  O ${details.open}  H ${details.high}  L ${details.low}  C ${details.close}  V ${details.volume}`;
}

async function exportDiagnostics(): Promise<void> {
  try {
    const data = await api<Record<string, unknown>>('/api/diagnostics');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `paper-lab-diagnostics-${new Date().toISOString().replaceAll(':', '')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    void notifyUser('SUCCESS', 'Diagnostics exported', 'Sanitized diagnostics export created.', 'diagnostics');
  } catch (error) {
    void notifyUser('ERROR', 'Action failed', message(error), 'application');
  }
  render();
}

function wireArenaEvents(): void {
  document.querySelector<HTMLButtonElement>('#arena-create-cancel')?.addEventListener('click', () => {
    state.arenaCreateMode = false;
    render();
  });

  document.querySelector<HTMLFormElement>('#arena-create-form')?.addEventListener('submit', event => {
    event.preventDefault();
    void createArenaFromForm();
  });

  document.querySelectorAll<HTMLElement>('[data-arena-id], [data-arena-object-id]').forEach(row => wireSelectableRow(row, () => {
    state.arenaCreateMode = false;
    state.selectedArenaId = row.dataset.arenaId ?? row.dataset.arenaObjectId ?? null;
    state.selectedExperienceId = null;
    state.experienceDetail = null;
    activateInspectorForSelection();
    render();
  }));

  document.querySelectorAll<HTMLElement>('[data-experience-id], [data-experience-object-id]').forEach(row => wireSelectableRow(row, () => {
    state.arenaCreateMode = false;
    const id = row.dataset.experienceId ?? row.dataset.experienceObjectId;
    if (id) void selectExperience(id);
  }));

  document.querySelector<HTMLButtonElement>('#arena-run-evaluation')?.addEventListener('click', () => void evaluateSelectedArena());
  document.querySelector<HTMLButtonElement>('#experience-export-results')?.addEventListener('click', () => void exportSelectedExperience());
}

async function createArenaFromForm(): Promise<void> {
  const baseArenaId = document.querySelector<HTMLSelectElement>('#arena-base-version')?.value ?? '';
  const name = document.querySelector<HTMLInputElement>('#arena-name')?.value.trim() ?? '';
  const symbol = document.querySelector<HTMLInputElement>('#arena-symbol')?.value.trim().toUpperCase() ?? '';
  const timeframe = document.querySelector<HTMLSelectElement>('#arena-timeframe')?.value ?? ARENA_CREATE_DEFAULTS.timeframe;
  const start = document.querySelector<HTMLInputElement>('#arena-start')?.value ?? '';
  const end = document.querySelector<HTMLInputElement>('#arena-end')?.value ?? '';
  const initialCapital = optionalNumberInput('#arena-capital');
  const warmupBars = optionalNumberInput('#arena-warmup');
  const commissionPerTrade = optionalNumberInput('#arena-commission');
  const slippageBps = optionalNumberInput('#arena-slippage');
  const rewardLambda = optionalNumberInput('#arena-reward-lambda');
  const maxDrawdownGate = optionalNumberInput('#arena-max-dd');
  const minimumTradeCount = optionalNumberInput('#arena-min-trades');
  const submit = document.querySelector<HTMLButtonElement>('.arena-create-submit');
  if (submit) { submit.disabled = true; submit.textContent = 'Capturing…'; }
  try {
    const arena = await api<Arena>('/api/arenas', {
      method: 'POST',
      body: JSON.stringify({ baseArenaId: baseArenaId || null, name, symbol, timeframe, start, end, initialCapital, warmupBars, commissionPerTrade, slippageBps, rewardLambda, maxDrawdownGate, minimumTradeCount })
    });
    await refreshBootstrap();
    state.arenaCreateMode = false;
    state.selectedArenaId = arena.id;
    state.selectedExperienceId = null;
    state.experienceDetail = null;
    activateInspectorForSelection();
    void notifyUser('SUCCESS', baseArenaId ? 'Arena version created' : 'Arena created', `${arena.name} v${arena.version} captured ${arena.symbolUniverse[0] ?? symbol} research data.`, 'arena', { type: 'Arena', id: arena.id, route: '/arenas' });
  } catch (error) {
    void notifyUser('ERROR', 'Arena creation failed', message(error), 'arena');
  }
  render();
}


async function exportSelectedExperience(): Promise<void> {
  const id = state.selectedExperienceId;
  if (!id) return;
  try {
    const detail = state.experienceDetail?.experience.id === id
      ? state.experienceDetail
      : await api<ExperienceDetailView>(`/api/experiences/${encodeURIComponent(id)}`);
    const payload = {
      format: 'paper-lab-experience-result',
      version: 1,
      product: state.data?.product ?? { name: 'Paper Lab', version: 'unknown' },
      exportedAt: new Date().toISOString(),
      experience: detail.experience,
      events: detail.events,
      trace: detail.trace
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `paper-lab-experience-${id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    void notifyUser('SUCCESS', 'Experience exported', `${id} scientific result exported.`, 'experience', { type: 'Experience', id, route: '/arenas' });
  } catch (error) {
    void notifyUser('ERROR', 'Experience export failed', message(error), 'experience');
  }
  render();
}


function optionalNumberInput(selector: string): number | undefined {
  const raw = document.querySelector<HTMLInputElement>(selector)?.value.trim() ?? '';
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

async function selectExperience(id: string): Promise<void> {
  const experience = state.data?.experiences.find(item => item.id === id);
  if (!experience) return;
  state.selectedExperienceId = id;
  state.selectedArenaId = experience.arenaVersionId;
  state.experienceDetail = null;
  state.experienceLoading = true;
  activateInspectorForSelection();
  render();
  try {
    const detail = await api<ExperienceDetailView>(`/api/experiences/${encodeURIComponent(id)}`);
    if (state.selectedExperienceId === id) state.experienceDetail = detail;
  } catch (error) {
    void notifyUser('ERROR', 'Experience load failed', message(error), 'experience');
  } finally {
    if (state.selectedExperienceId === id) state.experienceLoading = false;
    render();
  }
}

function wireEvolutionEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-run-id]').forEach(row => wireSelectableRow(row, () => {
    state.selectedRunId = row.dataset.runId ?? null;
    activateInspectorForSelection();
    render();
  }));
}

function wireSelectableRow(row: HTMLElement, select: () => void): void {
  row.addEventListener('click', select);
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
    }
  });
}

async function refreshBootstrap(): Promise<void> {
  state.data = await api<BootstrapView>('/api/bootstrap');
  normalizeSelections();
}

function navigate(page: AppPage): void {
  state.page = page;
  if (page !== 'ARENAS') state.arenaCreateMode = false;
  state.entityFilterFlyout = null;
  state.constrainedOverlay = null;
  if (state.shellMode !== 'desktop') state.narrowSurface = 'WORKSPACE';
  const path = pathForPage(page);
  if (page === 'ENTITIES' && state.selectedEntityId) history.pushState({}, '', `${path}?entity=${encodeURIComponent(state.selectedEntityId)}`);
  else if (page === 'LIVE' && state.liveActiveSymbol) history.pushState({}, '', `${path}?symbol=${encodeURIComponent(state.liveActiveSymbol)}`);
  else history.pushState({}, '', path);
  render();
  if (page === 'LIVE') void refreshLiveData();
  if (page === 'CONSOLE') void refreshConsole();
}

function updateUrlSelection(): void {
  if (state.page !== 'ENTITIES') return;
  const path = state.selectedEntityId ? `/entities?entity=${encodeURIComponent(state.selectedEntityId)}` : '/entities';
  history.replaceState({}, '', path);
}

function updateLiveUrl(): void {
  if (state.page !== 'LIVE') return;
  history.replaceState({}, '', state.liveActiveSymbol ? `/live?symbol=${encodeURIComponent(state.liveActiveSymbol)}` : '/live');
}

window.addEventListener('popstate', () => {
  state.page = pageFromLocation();
  if (state.page !== 'ARENAS') state.arenaCreateMode = false;
  state.selectedEntityId = entityFromLocation();
  const symbol = symbolFromLocation();
  if (symbol) state.liveActiveSymbol = symbol;
  normalizeSelections();
  render();
  if (state.page === 'LIVE') void refreshLiveData();
  if (state.page === 'CONSOLE') { state.consoleView = consoleViewFromLocation(); void refreshConsole(); }
});

function pageFromLocation(): AppPage {
  const path = location.pathname.toLowerCase();
  if (path.startsWith('/live')) return 'LIVE';
  if (path.startsWith('/arenas')) return 'ARENAS';
  if (path.startsWith('/evolution')) return 'EVOLUTION';
  if (path.startsWith('/benchmark')) return 'BENCHMARK';
  if (path.startsWith('/console')) return 'CONSOLE';
  if (path === '/' || path.startsWith('/entities')) return 'ENTITIES';
  return 'ENTITIES';
}

function entityFromLocation(): string | null {
  return new URL(location.href).searchParams.get('entity');
}

function symbolFromLocation(): string | null {
  return new URL(location.href).searchParams.get('symbol')?.trim().toUpperCase() || null;
}

function consoleViewFromLocation(): ConsoleView {
  const value = new URL(location.href).searchParams.get('view')?.toUpperCase();
  return value === 'LOGS' || value === 'AUDIT' || value === 'DIAGNOSTICS' ? value : 'OVERVIEW';
}

function pathForPage(page: AppPage): string {
  return page === 'LIVE' ? '/live' : page === 'ARENAS' ? '/arenas' : page === 'EVOLUTION' ? '/evolution' : page === 'BENCHMARK' ? '/benchmark' : page === 'CONSOLE' ? '/console' : '/entities';
}

function persistEntityPreferences(): void {
  writePreference<EntityPreferences>(ENTITY_PREF_KEY, {
    recent: state.recentEntityIds,
    pinned: state.pinnedEntityIds,
    sort: state.entitySort,
    filters: state.entityFilters
  });
}

function persistLivePreferences(): void {
  writePreference<LivePreferences>(LIVE_PREF_KEY, {
    objects: state.liveObjects,
    comparisonSymbols: state.liveComparisonSymbols,
    activeSymbol: state.liveActiveSymbol,
    range: state.liveRange,
    mode: state.liveMode,
    compareEnabled: state.liveCompareEnabled,
    stockFeed: state.liveStockFeed
  });
}

function normalizeEntityPreferences(value: Partial<EntityPreferences>): EntityPreferences {
  return {
    recent: Array.isArray(value.recent) ? value.recent.filter(item => typeof item === 'string').slice(0, 10) : [],
    pinned: Array.isArray(value.pinned) ? value.pinned.filter(item => typeof item === 'string') : [],
    sort: value.sort && typeof value.sort === 'object' ? value.sort : null,
    filters: normalizeEntityFilters(value.filters)
  };
}

function normalizeEntityFilters(value: unknown): EntityFilters {
  if (!value || typeof value !== 'object') return structuredClone(DEFAULT_ENTITY_FILTERS);
  const normalized: EntityFilters = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const column = key as EntityColumnKey;
    const candidates = Array.isArray(raw) ? raw : [raw];
    const rules = candidates.filter((item): item is EntityColumnFilter => {
      if (!item || typeof item !== 'object') return false;
      const rule = item as Partial<EntityColumnFilter>;
      return typeof rule.operator === 'string' && typeof rule.value === 'string';
    });
    if (rules.length) normalized[column] = rules;
  }
  return normalized;
}

function normalizeLivePreferences(value: Partial<LivePreferences>): LivePreferences {
  const objects = Array.isArray(value.objects)
    ? value.objects.filter(validAssetPreference)
    : [];
  const active = typeof value.activeSymbol === 'string' && objects.some(asset => asset.symbol === value.activeSymbol)
    ? value.activeSymbol
    : (objects[0]?.symbol ?? '');
  return {
    objects,
    comparisonSymbols: Array.isArray(value.comparisonSymbols) ? value.comparisonSymbols.filter(item => typeof item === 'string' && objects.some(asset => asset.symbol === item)) : [],
    activeSymbol: active,
    range: isLiveRangePreference(value.range) ? value.range : '1M',
    mode: isChartMode(value.mode) ? value.mode : 'CANDLES_VOLUME',
    compareEnabled: value.compareEnabled === true,
    stockFeed: value.stockFeed === 'sip' ? 'sip' : 'iex'
  };
}

function validAssetPreference(value: unknown): value is MarketAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<MarketAsset>;
  return typeof asset.symbol === 'string' && typeof asset.name === 'string' && (asset.assetClass === 'US_EQUITY' || asset.assetClass === 'CRYPTO');
}

function defaultAsset(symbol: string, assetClass: MarketAssetClass): MarketAsset {
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    assetClass,
    exchange: null,
    tradable: true,
    status: 'active'
  };
}

function isLiveRangePreference(value: unknown): value is LiveRange {
  return typeof value === 'string' && ['1D','5D','1M','3M','YTD','1Y','MAX'].includes(value);
}

function isChartMode(value: unknown): value is LiveChartMode {
  return value === 'CANDLES_VOLUME' || value === 'CANDLES' || value === 'LINE';
}

function cssEscape(value: string): string {
  return CSS.escape(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function bellIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a5 5 0 0 0-5 5v3.4c0 1.1-.4 2.1-1.1 2.9L4.5 16h15l-1.4-1.7a4.5 4.5 0 0 1-1.1-2.9V8a5 5 0 0 0-5-5Zm-2 15a2 2 0 0 0 4 0"/></svg>`;
}

function unreadNotificationCount(): number {
  return state.notifications.filter(item => !item.seen).length;
}

function filteredNotifications(): NotificationEvent[] {
  return state.notifications.filter(item => state.notificationFilters.every(rule => notificationMatchesRule(item, rule)));
}

function notificationMatchesRule(item: NotificationEvent, rule: NotificationFilterRule): boolean {
  const value = rule.value.trim().toLowerCase();
  if (!value) return true;
  if (rule.condition === 'IS') return item.severity.toLowerCase() === value;
  if (rule.condition === 'IS_NOT') return item.severity.toLowerCase() !== value;
  const searchable = `${item.title} ${item.message} ${item.category} ${item.target?.id ?? ''}`.toLowerCase();
  if (rule.condition === 'CONTAINS') return searchable.includes(value);
  return !searchable.includes(value);
}

function notificationConditionLabel(condition: NotificationFilterCondition): string {
  return ({ IS: 'Is', IS_NOT: 'Is not', CONTAINS: 'Contains', NOT_CONTAINS: 'Does not contain' })[condition];
}

function notificationFilterPills(): string {
  if (!state.notificationFilters.length) return '';
  return `<div class="notification-filter-rules" aria-label="Active notification filters">
    ${state.notificationFilters.map((rule, index) => `<button class="filter-rule-pill" data-remove-notification-filter="${index}" type="button" title="Remove ${escapeHtml(notificationConditionLabel(rule.condition))} ${escapeHtml(rule.value)}"><span>${escapeHtml(notificationConditionLabel(rule.condition))}</span><strong>:</strong><span>${escapeHtml(rule.value)}</span><b aria-hidden="true">×</b></button>`).join('')}
    <button id="notification-filter-clear-all" class="filter-clear-all" type="button">Clear all</button>
  </div>`;
}

function renderNotificationHistoryRow(item: NotificationEvent): string {
  return `<button class="notification-history-row severity-${item.severity.toLowerCase()} ${item.dismissed ? 'dismissed' : ''}" data-notification-id="${escapeHtml(item.id)}" type="button" role="listitem">
    <span class="notification-history-meta"><strong>${escapeHtml(item.severity)}</strong><time>${escapeHtml(new Date(item.createdAt).toLocaleString())}</time></span>
    <span class="notification-history-title">${escapeHtml(item.title)}</span>
    <span class="notification-history-message">${escapeHtml(item.message)}</span>
    ${item.dismissed ? '<span class="notification-history-state">Dismissed</span>' : ''}
  </button>`;
}

function renderGroupedNotificationHistory(rows: NotificationEvent[]): string {
  return groupNotificationHistory(rows).map(group => {
    const open = notificationGroupOpenState.get(group.key) ?? group.defaultOpen;
    return `<details class="notification-history-group granularity-${group.granularity.toLowerCase()}" data-notification-group="${escapeHtml(group.key)}" ${open ? 'open' : ''}>
      <summary><span>${escapeHtml(group.label)}</span><small>${group.notifications.length}</small></summary>
      <div class="notification-history-group-rows">${group.notifications.map(renderNotificationHistoryRow).join('')}</div>
    </details>`;
  }).join('');
}

function renderNotificationPanel(): string {
  const rows = filteredNotifications();
  const severityCondition = state.notificationFilterDraftCondition === 'IS' || state.notificationFilterDraftCondition === 'IS_NOT';
  const valueControl = severityCondition
    ? `<select id="notification-filter-value" class="control">${(['SUCCESS','INFO','WARNING','ERROR','CRITICAL'] as NotificationSeverity[]).map(level => `<option value="${level}" ${state.notificationFilterDraftValue === level ? 'selected' : ''}>${level}</option>`).join('')}</select>`
    : `<input id="notification-filter-value" class="control" type="text" value="${escapeHtml(state.notificationFilterDraftValue)}" placeholder="Value" autocomplete="off">`;
  return `<aside class="notification-panel shell-notification-${state.shellMode}" aria-label="Notification history">
    <div class="notification-center-header">
      <div><div class="eyebrow">Notifications</div><h2>History</h2></div>
      <div class="notification-panel-tools">
        <button id="notification-filter-button" class="table-tool filter-tool ${state.notificationFilters.length ? 'active' : ''}" type="button" aria-label="Filter notifications" aria-expanded="${state.notificationFilterOpen ? 'true' : 'false'}">${filterIcon()}${state.notificationFilters.length ? `<span class="filter-count">${state.notificationFilters.length}</span>` : ''}</button>
        <button id="notification-panel-close" class="icon-button notification-panel-close" type="button" aria-label="Close notifications">×</button>
      </div>
    </div>
    ${notificationFilterPills()}
    ${state.notificationFilterOpen ? `<div class="notification-filter-editor">
      <label class="stacked-field"><span>Condition</span><select id="notification-filter-condition" class="control">
        <option value="IS" ${state.notificationFilterDraftCondition === 'IS' ? 'selected' : ''}>Is</option>
        <option value="IS_NOT" ${state.notificationFilterDraftCondition === 'IS_NOT' ? 'selected' : ''}>Is not</option>
        <option value="CONTAINS" ${state.notificationFilterDraftCondition === 'CONTAINS' ? 'selected' : ''}>Contains</option>
        <option value="NOT_CONTAINS" ${state.notificationFilterDraftCondition === 'NOT_CONTAINS' ? 'selected' : ''}>Does not contain</option>
      </select></label>
      <label class="stacked-field"><span>Value</span>${valueControl}</label>
      <button id="notification-filter-add" class="button primary" type="button">Add filter</button>
    </div>` : ''}
    <div class="notification-history" role="list">
      ${rows.length ? (state.notificationFilters.length ? rows.map(renderNotificationHistoryRow).join('') : renderGroupedNotificationHistory(rows)) : '<div class="notification-empty">No notifications match this view.</div>'}
      ${state.notifications.length < state.notificationTotal && !state.notificationFilters.length ? `<button id="notification-load-older" class="button notification-load-older" type="button">Load older (${state.notificationTotal - state.notifications.length} remaining)</button>` : ''}
    </div>
  </aside>`;
}

function createToastElement(toast: ClientToast): HTMLElement {
  const element = document.createElement('article');
  element.className = `notification-toast severity-${toast.severity.toLowerCase()}`;
  element.dataset.toastKey = toast.key;
  element.setAttribute('role', toast.severity === 'ERROR' || toast.severity === 'CRITICAL' ? 'alert' : 'status');
  element.innerHTML = `
    <button class="notification-toast-close" data-dismiss-toast="${escapeHtml(toast.key)}" type="button" aria-label="Dismiss notification">×</button>
    <div class="notification-toast-severity">${escapeHtml(toast.severity)}</div>
    <strong>${escapeHtml(toast.title)}</strong>
    <p>${escapeHtml(toast.message)}</p>
    ${toast.durationMs === null ? '' : '<div class="notification-progress" aria-hidden="true"><span data-toast-progress></span></div>'}
  `;
  element.addEventListener('mouseenter', () => pauseSingleToast(toast.key));
  element.addEventListener('mouseleave', () => resumeSingleToast(toast.key));
  return element;
}

function syncToastHost(): void {
  toastHost.className = `notification-toast-stack shell-notification-${state.shellMode}${state.notificationCenterOpen ? ' notification-panel-open' : ''}`;

  const desired = new Set(state.toasts.map(toast => toast.key));
  toastHost.querySelectorAll<HTMLElement>('[data-toast-key]').forEach(element => {
    if (!element.dataset.toastKey || !desired.has(element.dataset.toastKey)) element.remove();
  });

  for (const toast of state.toasts) {
    let element = toastHost.querySelector<HTMLElement>(`[data-toast-key="${cssEscape(toast.key)}"]`);
    if (!element) {
      element = createToastElement(toast);
      const queueIndicator = toastHost.querySelector('.notification-toast-queue');
      toastHost.insertBefore(element, queueIndicator);
    }
  }

  let queueIndicator = toastHost.querySelector<HTMLElement>('.notification-toast-queue');
  if (toastQueue.length) {
    if (!queueIndicator) {
      queueIndicator = document.createElement('div');
      queueIndicator.className = 'notification-toast-queue';
      toastHost.appendChild(queueIndicator);
    }
    queueIndicator.textContent = `+${toastQueue.length} queued`;
  } else {
    queueIndicator?.remove();
  }

  updateToastProgressBars();
  startToastProgressLoop();
}

function notificationDuration(severity: NotificationSeverity): number | null {
  if (severity === 'SUCCESS') return 3500;
  if (severity === 'INFO') return 4000;
  if (severity === 'WARNING') return 5000;
  return null;
}

function expireToastSurface(): void {
  const expiring = [...state.toasts, ...toastQueue];
  for (const toast of expiring) {
    const timer = toastTimers.get(toast.key);
    if (timer !== undefined) window.clearTimeout(timer);
    toastTimers.delete(toast.key);
    void markSupersededToastDismissed(toast);
  }
  state.toasts = [];
  toastQueue.splice(0, toastQueue.length);
  stopToastProgressLoop();
  syncToastHost();
}

function enqueueToast(toast: ClientToast): void {
  // Toast presentation is coalesced by severity. History remains complete, but
  // only the newest active notification of a given severity stays on screen.
  supersedeToastSeverity(toast.severity);
  if (state.toasts.length < MAX_VISIBLE_TOASTS) {
    state.toasts = [...state.toasts, toast];
    scheduleToast(toast);
  } else {
    toastQueue.push(toast);
  }
  syncToastHost();
}

function supersedeToastSeverity(severity: NotificationSeverity): void {
  const visible = state.toasts.filter(item => item.severity === severity);
  if (visible.length) {
    for (const toast of visible) {
      const timer = toastTimers.get(toast.key);
      if (timer !== undefined) window.clearTimeout(timer);
      toastTimers.delete(toast.key);
      void markSupersededToastDismissed(toast);
    }
    state.toasts = state.toasts.filter(item => item.severity !== severity);
  }

  for (let index = toastQueue.length - 1; index >= 0; index -= 1) {
    const toast = toastQueue[index]!;
    if (toast.severity !== severity) continue;
    toastQueue.splice(index, 1);
    void markSupersededToastDismissed(toast);
  }
}

async function markSupersededToastDismissed(toast: ClientToast): Promise<void> {
  if (!toast.notificationId) {
    supersededToastKeys.add(toast.key);
    return;
  }
  try {
    await api(`/api/notifications/${encodeURIComponent(toast.notificationId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ dismissed: true, automatic: true })
    });
    const notification = state.notifications.find(item => item.id === toast.notificationId);
    if (notification) {
      notification.dismissed = true;
      notification.seen = true;
    }
  } catch {
    // Presentation replacement must not interfere with the new notification.
  }
}

function promoteQueuedToasts(): void {
  while (state.toasts.length < MAX_VISIBLE_TOASTS && toastQueue.length) {
    const next = toastQueue.shift()!;
    state.toasts = [...state.toasts, next];
    scheduleToast(next);
  }
}

function findToast(key: string): ClientToast | undefined {
  return state.toasts.find(item => item.key === key) ?? toastQueue.find(item => item.key === key);
}

async function notifyUser(
  severity: NotificationSeverity,
  title: string,
  text: string,
  category = 'general',
  target: NotificationEvent['target'] = null
): Promise<void> {
  const key = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const durationMs = notificationDuration(severity);
  const toast: ClientToast = {
    key,
    notificationId: null,
    severity,
    title,
    message: text,
    durationMs,
    remainingMs: durationMs,
    startedAt: null,
    hoverPaused: false
  };
  enqueueToast(toast);

  try {
    const persisted = await api<NotificationEvent>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ severity, category, title, message: text, target })
    });
    const current = findToast(key);
    if (current) current.notificationId = persisted.id;
    if (supersededToastKeys.delete(key)) {
      persisted.dismissed = true;
      persisted.seen = true;
      try {
        await api(`/api/notifications/${encodeURIComponent(persisted.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ dismissed: true, automatic: true })
        });
      } catch {
        // History may briefly show the event as active if this presentation-only update fails.
      }
    }

    const existed = state.notifications.some(item => item.id === persisted.id);
    state.notifications = [persisted, ...state.notifications.filter(item => item.id !== persisted.id)];
    if (!existed) state.notificationTotal += 1;
    render();
  } catch {
    // Notification persistence must never hide the original application outcome.
  }
}

function scheduleToast(toast: ClientToast): void {
  if (toast.durationMs === null || !toastClockActive || toast.hoverPaused || toastTimers.has(toast.key)) return;
  const remaining = toast.remainingMs ?? toast.durationMs;
  toast.startedAt = performance.now();
  const timer = window.setTimeout(() => void dismissToast(toast.key, true), remaining);
  toastTimers.set(toast.key, timer);
  startToastProgressLoop();
}

function toastRemaining(toast: ClientToast): number | null {
  if (toast.durationMs === null) return null;
  const base = toast.remainingMs ?? toast.durationMs;
  if (toast.startedAt === null) return base;
  return Math.max(0, base - (performance.now() - toast.startedAt));
}

function updateToastProgressBars(): void {
  for (const toast of state.toasts) {
    if (toast.durationMs === null) continue;
    const remaining = toastRemaining(toast) ?? 0;
    const percent = Math.max(0, Math.min(100, (remaining / Math.max(1, toast.durationMs)) * 100));
    const element = toastHost.querySelector<HTMLElement>(`[data-toast-key="${cssEscape(toast.key)}"] [data-toast-progress]`);
    if (element) element.style.width = `${percent}%`;
  }
}

function startToastProgressLoop(): void {
  if (toastProgressFrame !== null || !toastClockActive || !state.toasts.some(toast => toast.durationMs !== null)) return;
  const tick = () => {
    toastProgressFrame = null;
    updateToastProgressBars();
    if (toastClockActive && state.toasts.some(toast => toast.durationMs !== null)) {
      toastProgressFrame = requestAnimationFrame(tick);
    }
  };
  toastProgressFrame = requestAnimationFrame(tick);
}

function stopToastProgressLoop(): void {
  if (toastProgressFrame !== null) cancelAnimationFrame(toastProgressFrame);
  toastProgressFrame = null;
}

async function dismissToast(key: string, automatic = false): Promise<void> {
  const toast = state.toasts.find(item => item.key === key);
  if (!toast) return;

  const timer = toastTimers.get(key);
  if (timer !== undefined) window.clearTimeout(timer);
  toastTimers.delete(key);
  state.toasts = state.toasts.filter(item => item.key !== key);
  promoteQueuedToasts();
  syncToastHost();

  if (toast.notificationId) {
    try {
      await api(`/api/notifications/${encodeURIComponent(toast.notificationId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ dismissed: true, automatic })
      });
      const notification = state.notifications.find(item => item.id === toast.notificationId);
      if (notification) {
        notification.dismissed = true;
        notification.seen = true;
      }
      render();
    } catch {
      // History remains readable even if presentation update fails.
    }
  }
}

async function refreshNotifications(toastNew: boolean): Promise<void> {
  try {
    const known = new Set(state.notifications.map(item => item.id));
    const data = await api<NotificationListView>('/api/notifications?limit=300');
    state.notifications = data.notifications;
    state.notificationTotal = data.total;
    if (toastNew) {
      for (const item of data.notifications.filter(item => !known.has(item.id)).reverse()) {
        enqueueToast({
          key: `server-${item.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          notificationId: item.id,
          severity: item.severity,
          title: item.title,
          message: item.message,
          durationMs: notificationDuration(item.severity),
          remainingMs: notificationDuration(item.severity),
          startedAt: null,
          hoverPaused: false
        });
      }
    }
    render();
  } catch {
    // Notification history is secondary to the main application.
  }
}

async function loadOlderNotifications(): Promise<void> {
  try {
    const data = await api<NotificationListView>(`/api/notifications?limit=300&offset=${state.notifications.length}`);
    const seen = new Set(state.notifications.map(item => item.id));
    state.notifications = [...state.notifications, ...data.notifications.filter(item => !seen.has(item.id))];
    state.notificationTotal = data.total;
    render();
  } catch (error) {
    void notifyUser('ERROR', 'Notification history unavailable', message(error), 'notifications');
  }
}

async function markAllNotificationsSeen(): Promise<void> {
  if (!state.notifications.some(item => !item.seen)) return;
  state.notifications.forEach(item => { item.seen = true; });
  try { await api('/api/notifications/seen', { method: 'POST', body: '{}' }); } catch { /* presentation state only */ }
  render();
}

function openNotification(id: string): void {
  const item = state.notifications.find(value => value.id === id);
  if (!item?.target?.route) return;
  state.notificationCenterOpen = false;
  history.pushState({}, '', item.target.route);
  state.page = pageFromLocation();
  state.constrainedOverlay = null;
  if (state.shellMode !== 'desktop') state.narrowSurface = 'WORKSPACE';
  state.consoleView = consoleViewFromLocation();
  render();
  if (state.page === 'CONSOLE') void refreshConsole();
  if (state.page === 'LIVE') void refreshLiveData();
}

function pauseSingleToast(key: string): void {
  const toast = state.toasts.find(item => item.key === key);
  if (!toast || toast.durationMs === null || toast.hoverPaused) return;
  const timer = toastTimers.get(key);
  if (timer !== undefined) window.clearTimeout(timer);
  toastTimers.delete(key);
  toast.remainingMs = toastRemaining(toast);
  toast.startedAt = null;
  toast.hoverPaused = true;
  updateToastProgressBars();
}

function resumeSingleToast(key: string): void {
  const toast = state.toasts.find(item => item.key === key);
  if (!toast || toast.durationMs === null || !toast.hoverPaused) return;
  toast.hoverPaused = false;
  scheduleToast(toast);
  startToastProgressLoop();
}

function pauseToastTimers(): void {
  for (const toast of state.toasts) {
    if (toast.durationMs === null) continue;
    const timer = toastTimers.get(toast.key);
    if (timer !== undefined) window.clearTimeout(timer);
    toastTimers.delete(toast.key);
    toast.remainingMs = toastRemaining(toast);
    toast.startedAt = null;
  }
  stopToastProgressLoop();
  updateToastProgressBars();
}

function resumeToastTimers(): void {
  for (const toast of state.toasts) scheduleToast(toast);
  startToastProgressLoop();
}

let toastClockActive = !document.hidden && document.hasFocus();

function syncToastClock(): void {
  const active = !document.hidden && document.hasFocus();
  document.documentElement.classList.toggle('document-hidden', !active);
  if (active === toastClockActive) return;
  toastClockActive = active;
  if (active) resumeToastTimers();
  else pauseToastTimers();
}

document.addEventListener('visibilitychange', syncToastClock);
window.addEventListener('focus', syncToastClock);
window.addEventListener('blur', syncToastClock);
window.addEventListener('pagehide', () => persistLivePreferences());

async function refreshConsole(): Promise<void> {
  state.consoleLoading = true;
  state.consoleError = null;
  render();
  try {
    const [overview, logs, audit] = await Promise.all([
      api<ConsoleOverviewView>('/api/console/overview'),
      api<ConsoleLogsView>('/api/console/logs?limit=500'),
      api<ConsoleAuditView>('/api/audit/events?limit=500')
    ]);
    state.consoleOverview = overview;
    state.consoleLogs = logs.logs;
    state.consoleAuditEvents = audit.events;
  } catch (error) {
    state.consoleError = message(error);
  } finally {
    state.consoleLoading = false;
    render();
  }
}

function wireConsoleEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-console-view]').forEach(button => button.addEventListener('click', () => {
    state.consoleView = button.dataset.consoleView as ConsoleView;
    state.consoleSelectedLogIndex = null;
    state.consoleSelectedAuditId = null;
    history.replaceState({}, '', `/console?view=${state.consoleView.toLowerCase()}`);
    if (state.shellMode !== 'desktop') state.narrowSurface = 'WORKSPACE';
    render();
  }));
  document.querySelector<HTMLInputElement>('#console-log-search')?.addEventListener('input', event => { state.consoleLogSearch = (event.currentTarget as HTMLInputElement).value; render(); });
  document.querySelector<HTMLSelectElement>('#console-log-level')?.addEventListener('change', event => { state.consoleLogLevel = (event.currentTarget as HTMLSelectElement).value; render(); });
  document.querySelectorAll<HTMLElement>('[data-console-log-index]').forEach(row => wireSelectableRow(row, () => { state.consoleSelectedLogIndex = Number(row.dataset.consoleLogIndex); activateInspectorForSelection(); render(); }));
  document.querySelectorAll<HTMLElement>('[data-console-audit-id]').forEach(row => wireSelectableRow(row, () => { state.consoleSelectedAuditId = row.dataset.consoleAuditId ?? null; activateInspectorForSelection(); render(); }));
  document.querySelector<HTMLButtonElement>('#console-export-diagnostics')?.addEventListener('click', () => void exportDiagnostics());
  document.querySelector<HTMLButtonElement>('#console-verify-audit')?.addEventListener('click', async () => {
    try {
      const result = await api<{ valid: boolean; eventCount: number; reason: string | null }>('/api/audit/integrity');
      void notifyUser(result.valid ? 'SUCCESS' : 'CRITICAL', result.valid ? 'Audit integrity verified' : 'Audit integrity failed', result.valid ? `${result.eventCount} AuditEvents verified.` : (result.reason ?? 'Audit integrity verification failed.'), 'audit', { type: 'console', id: 'audit', route: '/console?view=audit' });
      await refreshConsole();
    } catch (error) { void notifyUser('ERROR', 'Audit verification failed', message(error), 'audit'); }
  });
  document.querySelector<HTMLButtonElement>('#console-verify-market-data')?.addEventListener('click', async () => {
    try {
      await api('/api/market-data/integrity/verify', { method: 'POST', body: '{}' });
      await refreshNotifications(true);
      await refreshConsole();
    } catch (error) { void notifyUser('ERROR', 'Market-data verification failed', message(error), 'integrity'); }
  });
}
