import type { MarketBar } from '../../domain/types.js';
import type { LiveChartView } from '../types.js';
import { escapeHtml } from '../shared/escape.js';
import { formatNumber, formatPrice } from '../shared/format.js';

export type LiveChartMode = 'CANDLES_VOLUME' | 'CANDLES' | 'LINE';

export interface CompareChartSeries {
  symbol: string;
  chart: LiveChartView;
}

export interface ChartViewport {
  start: number;
  end: number;
}

export interface LiveMouseDetails {
  kind: 'SINGLE' | 'COMPARE';
  time: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  values?: string;
}

export interface ChartHoverPoint {
  xRatio: number;
  yRatio: number;
  details: LiveMouseDetails;
}

const WIDTH = 1000;
const HEIGHT = 520;
const LEFT = 18;
const RIGHT = 82;
const TOP = 20;
const BOTTOM = 42;
const VOLUME_HEIGHT = 92;
const MIN_VIEW_SPAN = 0.04;

export const FULL_VIEWPORT: ChartViewport = { start: 0, end: 1 };

export function renderMarketChart(
  chart: LiveChartView | null,
  mode: LiveChartMode,
  compareEnabled: boolean,
  compareSeries: CompareChartSeries[],
  loading: boolean,
  error: string | null,
  viewport: ChartViewport
): string {
  if (loading) return '<div class="chart-state"><strong>Loading market data…</strong></div>';
  if (error) return `<div class="chart-state error-inline"><strong>Market data unavailable</strong><span>${escapeHtml(error)}</span></div>`;
  if (compareEnabled) return renderCompareChart(compareSeries, viewport);
  if (!chart || !chart.bars.length) return '<div class="chart-state"><strong>No chart data.</strong><span>Choose a symbol or range with available historical bars.</span></div>';
  return renderSingleChart(chart, mode, viewport);
}

export function zoomViewport(viewport: ChartViewport, center: number, factor: number): ChartViewport {
  const current = normalizeViewport(viewport);
  const span = current.end - current.start;
  const nextSpan = Math.max(MIN_VIEW_SPAN, Math.min(1, span * factor));
  if (nextSpan >= 0.9999) return { ...FULL_VIEWPORT };
  const c = Math.max(0, Math.min(1, center));
  let start = c - ((c - current.start) / span) * nextSpan;
  let end = start + nextSpan;
  if (start < 0) { end -= start; start = 0; }
  if (end > 1) { start -= end - 1; end = 1; }
  return normalizeViewport({ start, end });
}

export function panViewport(viewport: ChartViewport, delta: number): ChartViewport {
  const current = normalizeViewport(viewport);
  const span = current.end - current.start;
  if (span >= 0.9999) return current;
  let start = current.start + delta;
  let end = current.end + delta;
  if (start < 0) { end -= start; start = 0; }
  if (end > 1) { start -= end - 1; end = 1; }
  return normalizeViewport({ start, end });
}

export function singleHoverPoint(chart: LiveChartView, mode: LiveChartMode, viewport: ChartViewport, pointerRatio: number): ChartHoverPoint | null {
  const bars = visibleBars(chart.bars.filter(validBar), viewport);
  if (!bars.length) return null;
  const plotRatio = pointerToPlotRatio(pointerRatio);
  const index = nearestIndex(plotRatio, bars.length);
  const bar = bars[index]!;
  const volumeEnabled = mode === 'CANDLES_VOLUME';
  const plotBottom = HEIGHT - BOTTOM - (volumeEnabled ? VOLUME_HEIGHT + 24 : 0);
  const minPrice = Math.min(...bars.map(item => item.low));
  const maxPrice = Math.max(...bars.map(item => item.high));
  const padded = padRange(minPrice, maxPrice);
  const x = LEFT + ((index + 0.5) / bars.length) * (WIDTH - LEFT - RIGHT);
  const y = TOP + ((padded.max - bar.close) / (padded.max - padded.min)) * (plotBottom - TOP);
  return {
    xRatio: x / WIDTH,
    yRatio: y / HEIGHT,
    details: {
      kind: 'SINGLE',
      time: formatTime(bar.time),
      open: formatPrice(bar.open),
      high: formatPrice(bar.high),
      low: formatPrice(bar.low),
      close: formatPrice(bar.close),
      volume: formatNumber(bar.volume, 0)
    }
  };
}

export function compareHoverPoint(series: CompareChartSeries[], viewport: ChartViewport, pointerXRatio: number, pointerYRatio: number): ChartHoverPoint | null {
  const usable = comparisonData(series, viewport);
  if (!usable.length) return null;
  const allPoints = usable.flatMap(item => item.points);
  const values = allPoints.map(point => point.value);
  const range = padRange(Math.min(...values, 0), Math.max(...values, 0));
  const plotBottom = HEIGHT - BOTTOM;
  const targetIndexRatio = pointerToPlotRatio(pointerXRatio);
  const candidates = usable.map(item => {
    const index = nearestIndex(targetIndexRatio, item.points.length);
    const point = item.points[index]!;
    const y = TOP + ((range.max - point.value) / (range.max - range.min)) * (plotBottom - TOP);
    return { item, point, y, distance: Math.abs(y / HEIGHT - pointerYRatio) };
  });
  candidates.sort((a, b) => a.distance - b.distance);
  const snapped = candidates[0]!;
  const x = LEFT + targetIndexRatio * (WIDTH - LEFT - RIGHT);
  const time = snapped.point.time;
  const valueText = candidates
    .map(candidate => `${candidate.item.symbol} ${candidate.point.value >= 0 ? '+' : ''}${formatNumber(candidate.point.value, 2)}%`)
    .join(' · ');
  return {
    xRatio: x / WIDTH,
    yRatio: snapped.y / HEIGHT,
    details: { kind: 'COMPARE', time: formatTime(new Date(time).toISOString()), values: valueText }
  };
}

function renderSingleChart(chart: LiveChartView, mode: LiveChartMode, viewport: ChartViewport): string {
  const bars = visibleBars(chart.bars.filter(validBar), viewport);
  if (!bars.length) return '<div class="chart-state"><strong>No chart data.</strong></div>';

  const volumeEnabled = mode === 'CANDLES_VOLUME';
  const plotBottom = HEIGHT - BOTTOM - (volumeEnabled ? VOLUME_HEIGHT + 24 : 0);
  const plotHeight = plotBottom - TOP;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const minPrice = Math.min(...bars.map(bar => bar.low));
  const maxPrice = Math.max(...bars.map(bar => bar.high));
  const padded = padRange(minPrice, maxPrice);
  const xFor = (index: number) => LEFT + ((index + 0.5) / bars.length) * plotWidth;
  const yFor = (price: number) => TOP + ((padded.max - price) / (padded.max - padded.min)) * plotHeight;

  const grid = priceGrid(padded.min, padded.max, TOP, plotBottom);
  const axisLabels = `${priceAxisLabels(padded.min, padded.max, TOP, plotBottom, value => formatPrice(value))}${timeAxisLabels(bars, xFor)}`;
  const priceContent = mode === 'LINE' ? linePath(bars, xFor, yFor) : candleMarks(bars, xFor, yFor, plotWidth / bars.length);
  const volumeContent = volumeEnabled ? volumeMarks(bars, xFor, plotWidth / bars.length, HEIGHT - BOTTOM - VOLUME_HEIGHT, HEIGHT - BOTTOM) : '';

  return `
    <div class="market-chart-frame" id="market-chart-frame" data-chart-kind="single">
      <svg class="market-chart-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(chart.symbol)} historical chart">
        ${grid}${priceContent}${volumeContent}
      </svg>
      <div class="chart-axis-layer" aria-hidden="true">${axisLabels}</div>
      <div class="chart-crosshair vertical" id="chart-crosshair-v" hidden></div>
      <div class="chart-crosshair horizontal" id="chart-crosshair-h" hidden></div>
      <div class="chart-hover" id="chart-hover" hidden></div>
    </div>`;
}

function renderCompareChart(series: CompareChartSeries[], viewport: ChartViewport): string {
  const normalized = comparisonData(series, viewport);
  if (!normalized.length) return '<div class="chart-state"><strong>Select symbols using the comparison checkboxes.</strong></div>';

  const allPoints = normalized.flatMap(item => item.points);
  const minTime = Math.min(...allPoints.map(point => point.time));
  const maxTime = Math.max(...allPoints.map(point => point.time));
  const values = allPoints.map(point => point.value);
  const range = padRange(Math.min(...values, 0), Math.max(...values, 0));
  const plotBottom = HEIGHT - BOTTOM;
  const plotHeight = plotBottom - TOP;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const xFor = (time: number) => LEFT + (maxTime === minTime ? 0.5 : (time - minTime) / (maxTime - minTime)) * plotWidth;
  const yFor = (value: number) => TOP + ((range.max - value) / (range.max - range.min)) * plotHeight;

  const grid = percentGrid(range.min, range.max, TOP, plotBottom);
  const axisLabels = `${priceAxisLabels(range.min, range.max, TOP, plotBottom, value => `${value >= 0 ? '+' : ''}${formatNumber(value, 1)}%`)}${compareTimeAxisLabels(minTime, maxTime)}`;
  const paths = normalized.map((item, index) => {
    const d = item.points.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'} ${xFor(point.time).toFixed(2)} ${yFor(point.value).toFixed(2)}`).join(' ');
    return `<path class="compare-line compare-series-${index % 8}" d="${d}" fill="none" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  const legend = normalized.map((item, index) => `<span class="compare-legend-item compare-series-${index % 8}"><i></i>${escapeHtml(item.symbol)}</span>`).join('');

  return `
    <div class="market-chart-frame compare-chart" id="market-chart-frame" data-chart-kind="compare">
      <div class="compare-legend">${legend}</div>
      <svg class="market-chart-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="Percentage comparison chart">${grid}${paths}</svg>
      <div class="chart-axis-layer" aria-hidden="true">${axisLabels}</div>
      <div class="chart-crosshair vertical" id="chart-crosshair-v" hidden></div>
      <div class="chart-crosshair horizontal" id="chart-crosshair-h" hidden></div>
      <div class="chart-hover" id="chart-hover" hidden></div>
    </div>`;
}

function comparisonData(series: CompareChartSeries[], viewport: ChartViewport) {
  return series.map(item => {
    const full = item.chart.bars.filter(validBar);
    if (!full.length || full[0]!.close === 0) return null;
    const base = full[0]!.close;
    const bars = visibleBars(full, viewport);
    return {
      symbol: item.symbol,
      points: bars.map(bar => ({ time: Date.parse(bar.time), value: (bar.close / base - 1) * 100 }))
    };
  }).filter((item): item is { symbol: string; points: Array<{ time: number; value: number }> } => Boolean(item?.points.length));
}

function visibleBars(bars: MarketBar[], viewport: ChartViewport): MarketBar[] {
  if (!bars.length) return [];
  const view = normalizeViewport(viewport);
  if (view.start <= 0 && view.end >= 1) return bars;
  const start = Math.max(0, Math.min(bars.length - 1, Math.floor(view.start * bars.length)));
  const end = Math.max(start + 1, Math.min(bars.length, Math.ceil(view.end * bars.length)));
  return bars.slice(start, end);
}

function normalizeViewport(viewport: ChartViewport): ChartViewport {
  const start = Math.max(0, Math.min(1, Number.isFinite(viewport.start) ? viewport.start : 0));
  const end = Math.max(start + MIN_VIEW_SPAN, Math.min(1, Number.isFinite(viewport.end) ? viewport.end : 1));
  if (end > 1) return { start: Math.max(0, 1 - (end - start)), end: 1 };
  return { start, end };
}


function pointerToPlotRatio(ratio: number): number {
  const left = LEFT / WIDTH;
  const span = (WIDTH - LEFT - RIGHT) / WIDTH;
  return Math.max(0, Math.min(1, (ratio - left) / span));
}

function nearestIndex(ratio: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(Math.max(0, Math.min(1, ratio)) * Math.max(0, length - 1))));
}

function candleMarks(bars: MarketBar[], xFor: (index: number) => number, yFor: (price: number) => number, slotWidth: number): string {
  const width = Math.max(1.2, Math.min(8, slotWidth * 0.62));
  return bars.map((bar, index) => {
    const x = xFor(index);
    const open = yFor(bar.open), close = yFor(bar.close), high = yFor(bar.high), low = yFor(bar.low);
    const positive = bar.close >= bar.open;
    const top = Math.min(open, close);
    const height = Math.max(1.2, Math.abs(close - open));
    return `<g class="candle ${positive ? 'positive' : 'negative'}"><line x1="${x}" x2="${x}" y1="${high}" y2="${low}" vector-effect="non-scaling-stroke"/><rect x="${x - width / 2}" y="${top}" width="${width}" height="${height}" vector-effect="non-scaling-stroke"/></g>`;
  }).join('');
}

function linePath(bars: MarketBar[], xFor: (index: number) => number, yFor: (price: number) => number): string {
  const d = bars.map((bar, index) => `${index ? 'L' : 'M'} ${xFor(index).toFixed(2)} ${yFor(bar.close).toFixed(2)}`).join(' ');
  return `<path class="price-line" d="${d}" fill="none" vector-effect="non-scaling-stroke"/>`;
}

function volumeMarks(bars: MarketBar[], xFor: (index: number) => number, slotWidth: number, top: number, bottom: number): string {
  const maxVolume = Math.max(...bars.map(bar => bar.volume), 1);
  const width = Math.max(1, Math.min(7, slotWidth * 0.7));
  return bars.map((bar, index) => {
    const height = (bar.volume / maxVolume) * (bottom - top);
    return `<rect class="volume-bar ${bar.close >= bar.open ? 'positive' : 'negative'}" x="${xFor(index) - width / 2}" y="${bottom - height}" width="${width}" height="${height}"/>`;
  }).join('');
}

function priceGrid(min: number, max: number, top: number, bottom: number): string { return gridLines(min, max, top, bottom, value => formatPrice(value)); }
function percentGrid(min: number, max: number, top: number, bottom: number): string { return gridLines(min, max, top, bottom, value => `${value >= 0 ? '+' : ''}${formatNumber(value, 1)}%`); }

function gridLines(min: number, max: number, top: number, bottom: number, _label: (value: number) => string): string {
  return Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = top + ratio * (bottom - top);
    return `<g class="chart-grid"><line x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y}" y2="${y}" vector-effect="non-scaling-stroke"/></g>`;
  }).join('');
}

function priceAxisLabels(min: number, max: number, top: number, bottom: number, label: (value: number) => string): string {
  return Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = top + ratio * (bottom - top);
    const value = max - ratio * (max - min);
    return `<span class="chart-axis-label price" style="top:${((y / HEIGHT) * 100).toFixed(3)}%">${escapeHtml(label(value))}</span>`;
  }).join('');
}

function timeAxisLabels(bars: MarketBar[], xFor: (index: number) => number): string {
  const count = Math.min(6, bars.length);
  if (count <= 1) return '';
  const firstTime = Date.parse(bars[0]!.time);
  const lastTime = Date.parse(bars[bars.length - 1]!.time);
  const spanMs = Math.max(0, lastTime - firstTime);
  return Array.from({ length: count }, (_, tick) => {
    const index = Math.round((tick / (count - 1)) * (bars.length - 1));
    const edgeClass = tick === 0 ? ' first' : tick === count - 1 ? ' last' : '';
    return `<span class="chart-axis-label time${edgeClass}" data-chart-time-label style="left:${((xFor(index) / WIDTH) * 100).toFixed(3)}%">${escapeHtml(formatAxisTime(bars[index]!.time, spanMs))}</span>`;
  }).join('');
}

function compareTimeAxisLabels(minTime: number, maxTime: number): string {
  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) return '';
  const count = 6;
  const spanMs = Math.max(0, maxTime - minTime);
  return Array.from({ length: count }, (_, tick) => {
    const ratio = tick / (count - 1);
    const time = minTime + ratio * (maxTime - minTime);
    const x = LEFT + ratio * (WIDTH - LEFT - RIGHT);
    const edgeClass = tick === 0 ? ' first' : tick === count - 1 ? ' last' : '';
    return `<span class="chart-axis-label time${edgeClass}" data-chart-time-label style="left:${((x / WIDTH) * 100).toFixed(3)}%">${escapeHtml(formatAxisTime(new Date(time).toISOString(), spanMs))}</span>`;
  }).join('');
}

function formatAxisTime(value: string, spanMs: number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (spanMs <= 36 * hour) return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (spanMs <= 14 * day) return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (spanMs <= 180 * day) return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (spanMs <= 800 * day) return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return date.toLocaleDateString(undefined, { year: 'numeric' });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function padRange(min: number, max: number): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) {
    const pad = Math.abs(min || 1) * 0.01;
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.06;
  return { min: min - pad, max: max + pad };
}

function validBar(bar: MarketBar): boolean {
  return [bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) && Number.isFinite(Date.parse(bar.time));
}
