import type { MarketAsset } from '../../domain/types.js';
import type { AuditIntegrityView, LiveChartView, LiveQuoteView, ProviderView } from '../types.js';
import type { ChartViewport, CompareChartSeries, LiveChartMode, LiveMouseDetails } from '../live/chart.js';
import { renderMarketChart } from '../live/chart.js';
import { escapeHtml } from '../shared/escape.js';
import { formatNumber, formatPrice } from '../shared/format.js';

export type LiveRange = '1D' | '5D' | '1M' | '3M' | 'YTD' | '1Y' | 'MAX';
export type LiveInspectorContext = 'SYMBOL' | 'CHART';

export interface LivePageInput {
  objects: MarketAsset[];
  activeSymbol: string;
  comparisonSymbols: string[];
  search: string;
  searchOpen: boolean;
  searchLoading: boolean;
  searchError: string | null;
  searchResults: MarketAsset[];
  range: LiveRange;
  mode: LiveChartMode;
  compareEnabled: boolean;
  stockFeed: string;
  quote: LiveQuoteView | null;
  chart: LiveChartView | null;
  compareSeries: CompareChartSeries[];
  viewport: ChartViewport;
  mouseDetails: LiveMouseDetails | null;
  loading: boolean;
  error: string | null;
  inspectorContext: LiveInspectorContext;
  provider: ProviderView;
  auditIntegrity: AuditIntegrityView;
}

export function renderLivePage(input: LivePageInput): { objects: string; workspace: string; inspector: string } {
  const active = input.objects.find(asset => asset.symbol === input.activeSymbol) ?? input.objects[0] ?? null;
  return {
    objects: renderObjects(input),
    workspace: renderWorkspace(input, active),
    inspector: input.inspectorContext === 'CHART' ? chartInspector(input, active) : symbolInspector(input, active)
  };
}

function renderObjects(input: LivePageInput): string {
  const investments = input.objects.filter(asset => asset.assetClass === 'US_EQUITY');
  const crypto = input.objects.filter(asset => asset.assetClass === 'CRYPTO');
  return `
    <div class="panel-heading"><div><div class="eyebrow">Objects</div><h2>Live</h2></div></div>
    <div class="asset-search-wrap">
      <input id="live-asset-search" class="control" type="search" value="${escapeHtml(input.search)}" placeholder="Search market symbols" autocomplete="off" aria-label="Search market symbols">
      ${input.searchOpen ? searchFlyout(input) : ''}
    </div>
    ${assetSection('Investments', investments, input)}
    ${assetSection('Crypto', crypto, input)}
  `;
}

function searchFlyout(input: LivePageInput): string {
  const existing = new Set(input.objects.map(asset => asset.symbol));
  const available = input.searchResults.filter(asset => !existing.has(asset.symbol));
  const content = input.searchLoading
    ? '<div class="asset-search-state">Searching…</div>'
    : input.searchError
      ? `<div class="asset-search-state error-inline">${escapeHtml(input.searchError)}</div>`
      : available.length
        ? available.map(asset => `
            <button class="asset-search-result" data-add-market-symbol="${escapeHtml(asset.symbol)}" data-asset-class="${asset.assetClass}" data-asset-name="${escapeHtml(asset.name)}" data-asset-exchange="${escapeHtml(asset.exchange ?? '')}" type="button">
              <span><strong>${escapeHtml(asset.symbol)}</strong><small>${escapeHtml(asset.name)}</small></span>
              <em>${asset.assetClass === 'CRYPTO' ? 'Crypto' : escapeHtml(asset.exchange ?? 'Equity')}</em>
            </button>`).join('')
        : `<div class="asset-search-state">${input.search.trim() ? 'No new matching symbols.' : 'Type to search Alpaca assets.'}</div>`;
  return `<div class="asset-search-flyout" role="listbox">${content}</div>`;
}

function assetSection(label: string, assets: MarketAsset[], input: LivePageInput): string {
  return `
    <section class="object-section market-object-section">
      <div class="object-section-title">${escapeHtml(label)}</div>
      <div class="object-list">
        ${assets.length ? assets.map(asset => assetRow(asset, input)).join('') : `<div class="object-section-empty">No ${label.toLowerCase()} added.</div>`}
      </div>
    </section>`;
}

function assetRow(asset: MarketAsset, input: LivePageInput): string {
  const checked = input.comparisonSymbols.includes(asset.symbol);
  return `
    <div class="object-row market-object-row ${asset.symbol === input.activeSymbol ? 'selected' : ''}" data-live-symbol="${escapeHtml(asset.symbol)}" tabindex="0">
      <div class="object-row-copy"><strong>${escapeHtml(asset.symbol)}</strong><span>${escapeHtml(asset.name)}</span></div>
      <label class="compare-check" data-compare-check-label="${escapeHtml(asset.symbol)}" title="Include ${escapeHtml(asset.symbol)} in Compare%">
        <input type="checkbox" data-compare-symbol="${escapeHtml(asset.symbol)}" ${checked ? 'checked' : ''} aria-label="Include ${escapeHtml(asset.symbol)} in Compare%">
        <span aria-hidden="true"></span>
      </label>
    </div>`;
}

function renderWorkspace(input: LivePageInput, active: MarketAsset | null): string {
  const displaySymbol = (active?.symbol ?? input.activeSymbol) || 'Live';
  return `
    <div class="workspace-header live-workspace-header">
      <button id="live-chart-title" class="chart-title-button ${input.inspectorContext === 'CHART' ? 'active' : ''}" type="button" aria-label="Inspect chart settings">
        <div class="eyebrow">Market observation</div><h1>${escapeHtml(displaySymbol)}</h1>
      </button>
      <div class="chart-toolbar">
        <div class="range-group" role="group" aria-label="Chart range">
          ${(['1D','5D','1M','3M','YTD','1Y','MAX'] as LiveRange[]).map(range => `<button class="range-button ${input.range === range ? 'active' : ''}" data-live-range="${range}" type="button">${range}</button>`).join('')}
        </div>
        ${presentationSelect('live-chart-presentation', input)}
      </div>
    </div>
    <div class="live-workspace chart-workspace">
      ${renderMarketChart(input.chart, input.mode, input.compareEnabled, input.compareSeries, input.loading, input.error, input.viewport)}
    </div>`;
}

function symbolInspector(input: LivePageInput, active: MarketAsset | null): string {
  if (!active) return `<div class="inspector-section profile"><div class="eyebrow">Inspector</div><h2>No symbol</h2><div class="placeholder">Add a symbol from market search.</div></div>`;
  const quote = input.quote?.quote;
  return `
    <div class="inspector-section profile"><div class="eyebrow">Inspector · Symbol</div><h2>${escapeHtml(active.symbol)}</h2><div class="subtitle">${escapeHtml(active.name)}</div></div>
    <div class="inspector-section"><h3>Profile</h3>
      ${field('Asset class', active.assetClass === 'CRYPTO' ? 'Crypto' : 'Investment')}
      ${field('Exchange', active.exchange ?? '—')}
      ${field('Provider', 'Alpaca')}
      ${field('Feed', quote?.feed.toUpperCase() ?? (active.assetClass === 'CRYPTO' ? 'CRYPTO_US' : input.stockFeed.toUpperCase()))}
      ${field('Bid', quote ? formatPrice(quote.bidPrice) : '—')}
      ${field('Bid size', quote ? formatNumber(quote.bidSize, 0) : '—')}
      ${field('Ask', quote ? formatPrice(quote.askPrice) : '—')}
      ${field('Ask size', quote ? formatNumber(quote.askSize, 0) : '—')}
      ${field('Quote time', quote?.timestamp ?? '—')}
    </div>
    ${actionsSection(input, active)}
    ${mouseDetailsSection(input.mouseDetails)}
    ${chartSetupSection(input, active)}
    <div class="inspector-section"><h3>Research boundary</h3><div class="placeholder">Live browsing is ephemeral display data. It does not create MarketDataSnapshots or scored research evidence.</div></div>
    ${systemSection(input)}
  `;
}

function chartInspector(input: LivePageInput, active: MarketAsset | null): string {
  return `
    <div class="inspector-section profile"><div class="eyebrow">Inspector · Chart</div><h2>${escapeHtml(active?.symbol ?? 'Live chart')}</h2><div class="subtitle">Interactive chart settings and loaded market-data window.</div></div>
    ${actionsSection(input, active)}
    ${mouseDetailsSection(input.mouseDetails)}
    ${chartSetupSection(input, active)}
    <div class="inspector-section"><h3>Loaded data</h3>
      ${field('Resolved timeframe', input.chart?.timeframe ?? '—')}
      ${field('Provider', input.chart?.provider ?? 'Alpaca')}
      ${field('Requested start', input.chart?.requestedStart ?? '—')}
      ${field('Requested end', input.chart?.requestedEnd ?? '—')}
      ${field('Actual start', input.chart?.actualStart ?? '—')}
      ${field('Actual end', input.chart?.actualEnd ?? '—')}
      ${field('Bar count', String(input.chart?.bars.length ?? 0))}
      ${field('Comparison symbols', input.comparisonSymbols.length ? input.comparisonSymbols.join(', ') : 'None')}
    </div>
    <div class="inspector-section"><h3>Research boundary</h3><div class="placeholder">Changing range, presentation, symbol, zoom, pan, or Compare% never creates a MarketDataSnapshot. Only Arena-bound scored evaluation enters the immutable provenance path.</div></div>
    ${systemSection(input)}
  `;
}

function actionsSection(input: LivePageInput, active: MarketAsset | null): string {
  const included = active ? input.comparisonSymbols.includes(active.symbol) : false;
  return `
    <div class="inspector-section"><h3>Actions</h3><div class="action-grid">
      <button id="live-refresh-data" class="button" type="button" ${active ? '' : 'disabled'}>Refresh</button>
      <button id="live-inspector-compare" class="button" type="button" ${active ? '' : 'disabled'}>${included ? 'Exclude Compare%' : 'Include Compare%'}</button>
      <button id="live-inspector-remove" class="button" type="button" ${active ? '' : 'disabled'}>Remove from watchlist</button>
    </div></div>`;
}

function mouseDetailsSection(details: LiveMouseDetails | null): string {
  return `
    <div class="inspector-section" id="live-mouse-details"><h3>Mouse details</h3>
      <div class="field-row"><span>Time</span><strong id="live-mouse-time">${escapeHtml(details?.time ?? '—')}</strong></div>
      <div class="field-row"><span>Open</span><strong id="live-mouse-open">${escapeHtml(details?.open ?? '—')}</strong></div>
      <div class="field-row"><span>High</span><strong id="live-mouse-high">${escapeHtml(details?.high ?? '—')}</strong></div>
      <div class="field-row"><span>Low</span><strong id="live-mouse-low">${escapeHtml(details?.low ?? '—')}</strong></div>
      <div class="field-row"><span>Close</span><strong id="live-mouse-close">${escapeHtml(details?.close ?? '—')}</strong></div>
      <div class="field-row"><span>Volume / Compare</span><strong id="live-mouse-volume">${escapeHtml(details?.values ?? details?.volume ?? '—')}</strong></div>
    </div>`;
}

function chartSetupSection(input: LivePageInput, active: MarketAsset | null): string {
  return `
    <div class="inspector-section"><h3>Chart</h3>
      <label class="inspector-edit-field"><span>Range</span><select id="inspector-live-range" class="control">${(['1D','5D','1M','3M','YTD','1Y','MAX'] as LiveRange[]).map(range => `<option value="${range}" ${input.range === range ? 'selected' : ''}>${range}</option>`).join('')}</select></label>
      <label class="inspector-edit-field"><span>Presentation</span>${presentationSelect('inspector-live-presentation', input, 'control')}</label>
      ${active?.assetClass === 'US_EQUITY' ? `<label class="inspector-edit-field"><span>Feed</span><select id="inspector-live-feed" class="control">${feedOption('iex', input.stockFeed)}${feedOption('sip', input.stockFeed)}</select></label>` : field('Feed', 'CRYPTO_US')}
      ${field('Viewport', input.viewport.start <= 0 && input.viewport.end >= 1 ? 'Full range' : `${formatNumber(input.viewport.start * 100, 0)}% – ${formatNumber(input.viewport.end * 100, 0)}%`)}
    </div>`;
}

// Compare% uses line rendering; the presentation selector owns entry/exit from comparison mode.
function presentationSelect(id: string, input: LivePageInput, className = 'toolbar-select'): string {
  const selected = input.compareEnabled ? 'COMPARE' : input.mode;
  return `<select id="${id}" class="${className}" aria-label="Chart presentation">
    <option value="CANDLES_VOLUME" ${selected === 'CANDLES_VOLUME' ? 'selected' : ''}>Candles + Volume</option>
    <option value="COMPARE" ${selected === 'COMPARE' ? 'selected' : ''}>Compare%</option>
    <option value="CANDLES" ${selected === 'CANDLES' ? 'selected' : ''}>Candles</option>
    <option value="LINE" ${selected === 'LINE' ? 'selected' : ''}>Line</option>
  </select>`;
}

function systemSection(input: LivePageInput): string {
  return `
    <div class="inspector-section"><h3>System</h3>
      ${field('Provider configured', input.provider.configured ? 'Yes' : 'No')}
      ${field('Audit integrity', input.auditIntegrity.valid ? 'Valid' : 'FAILED')}
      ${field('Audit events', String(input.auditIntegrity.eventCount))}
    </div>`;
}

function feedOption(value: string, selected: string): string {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${value.toUpperCase()}</option>`;
}

function field(label: string, value: string): string {
  return `<div class="field-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}
