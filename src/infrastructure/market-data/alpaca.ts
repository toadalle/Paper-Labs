import type { CapabilityState, MarketAsset, MarketAssetClass, MarketBar, MarketQuote } from '../../domain/types.js';
import { config, alpacaConfigured } from '../config.js';
import type {
  HistoricalBarsRequest,
  LatestQuoteRequest,
  MarketDataCapabilities,
  MarketDataProvider,
  SearchAssetsRequest
} from './provider.js';

type ErrorCategory = 'CONFIGURATION' | 'CREDENTIALS' | 'NOT_ENTITLED' | 'RATE_LIMIT' | 'UNREACHABLE' | 'PROVIDER';

interface AlpacaAssetPayload {
  symbol?: unknown;
  name?: unknown;
  class?: unknown;
  exchange?: unknown;
  status?: unknown;
  tradable?: unknown;
}

export class AlpacaError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly status: number | null
  ) {
    super(message);
    this.name = 'AlpacaError';
  }
}

export function capabilityState(error: AlpacaError | null): CapabilityState {
  if (!error) return 'AVAILABLE';
  if (error.category === 'NOT_ENTITLED') return 'NOT_ENTITLED';
  if (error.category === 'UNREACHABLE') return 'UNREACHABLE';
  return 'UNKNOWN';
}

function classify(status: number, text: string): AlpacaError {
  const lowered = text.toLowerCase();
  if (status === 401) return new AlpacaError('Alpaca rejected the configured credentials.', 'CREDENTIALS', status);
  if (status === 403 || lowered.includes('not entitled') || lowered.includes('subscription does not permit')) {
    return new AlpacaError('The Alpaca account is not entitled to the requested feed.', 'NOT_ENTITLED', status);
  }
  if (status === 429) return new AlpacaError('Alpaca rate limit reached.', 'RATE_LIMIT', status);
  return new AlpacaError(`Alpaca ${status}: ${text || 'request failed'}`, 'PROVIDER', status);
}

let nextRequestAt = 0;
async function pacedFetch(url: string): Promise<Response> {
  if (!alpacaConfigured()) throw new AlpacaError('Alpaca credentials are not configured.', 'CONFIGURATION', null);
  const now = Date.now();
  const scheduled = Math.max(now, nextRequestAt);
  nextRequestAt = scheduled + config.alpacaMinRequestIntervalMs;
  if (scheduled > now) await new Promise(resolve => setTimeout(resolve, scheduled - now));

  try {
    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': config.alpacaApiKey,
        'APCA-API-SECRET-KEY': config.alpacaSecretKey
      },
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) throw classify(response.status, await response.text());
    return response;
  } catch (error) {
    if (error instanceof AlpacaError) throw error;
    throw new AlpacaError(error instanceof Error ? error.message : String(error), 'UNREACHABLE', null);
  }
}

async function probe(url: string): Promise<AlpacaError | null> {
  try {
    await pacedFetch(url);
    return null;
  } catch (error) {
    return error instanceof AlpacaError ? error : new AlpacaError(String(error), 'PROVIDER', null);
  }
}

function parseQuote(symbol: string, feed: string, assetClass: MarketAssetClass, raw: Record<string, unknown>): MarketQuote {
  return {
    symbol: symbol.toUpperCase(),
    assetClass,
    timestamp: String(raw.t ?? ''),
    bidPrice: Number(raw.bp),
    bidSize: Number(raw.bs),
    askPrice: Number(raw.ap),
    askSize: Number(raw.as),
    provider: 'alpaca',
    feed
  };
}

function parseBar(raw: Record<string, unknown>): MarketBar {
  const value: MarketBar = {
    time: String(raw.t ?? ''),
    open: Number(raw.o),
    high: Number(raw.h),
    low: Number(raw.l),
    close: Number(raw.c),
    volume: Number(raw.v)
  };
  if (raw.n !== undefined) value.tradeCount = Number(raw.n);
  if (raw.vw !== undefined) value.vwap = Number(raw.vw);
  return value;
}

function parseAsset(raw: AlpacaAssetPayload, assetClass: MarketAssetClass): MarketAsset | null {
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim().toUpperCase() : '';
  if (!symbol) return null;
  return {
    symbol,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : symbol,
    assetClass,
    exchange: typeof raw.exchange === 'string' && raw.exchange.trim() ? raw.exchange.trim() : null,
    tradable: raw.tradable === true,
    status: typeof raw.status === 'string' ? raw.status : 'unknown'
  };
}

function dataOrigin(): string {
  try {
    return new URL(config.alpacaDataBaseUrl).origin;
  } catch {
    return 'https://data.alpaca.markets';
  }
}

export class AlpacaProvider implements MarketDataProvider {
  readonly id = 'alpaca';
  private assetCache = new Map<MarketAssetClass, { loadedAt: number; assets: MarketAsset[] }>();

  async capabilities(): Promise<MarketDataCapabilities> {
    if (!alpacaConfigured()) {
      return {
        checkedAt: null,
        configured: false,
        historical: { iex: 'UNKNOWN', sip: 'UNKNOWN', crypto_us: 'UNKNOWN' },
        live: { iex: 'UNKNOWN', sip: 'UNKNOWN', delayed_sip: 'UNKNOWN', crypto_us: 'UNKNOWN' },
        assetClasses: ['US_EQUITY', 'CRYPTO'],
        notes: ['Alpaca credentials are not configured.']
      };
    }

    const end = new Date(Date.now() - 16 * 60_000);
    const start = new Date(end.getTime() - 60_000);
    const histParams = (feed: string) => new URLSearchParams({
      timeframe: '1Min',
      start: start.toISOString(),
      end: end.toISOString(),
      feed,
      adjustment: 'split',
      limit: '1'
    });
    const cryptoParams = new URLSearchParams({ symbols: 'BTC/USD', timeframe: '1Min', start: start.toISOString(), end: end.toISOString(), limit: '1' });

    const [iexLive, sipLive, delayedLive, iexHistorical, sipHistorical, cryptoLive, cryptoHistorical] = await Promise.all([
      probe(`${config.alpacaDataBaseUrl}/stocks/SPY/quotes/latest?feed=iex`),
      probe(`${config.alpacaDataBaseUrl}/stocks/SPY/quotes/latest?feed=sip`),
      probe(`${config.alpacaDataBaseUrl}/stocks/SPY/quotes/latest?feed=delayed_sip`),
      probe(`${config.alpacaDataBaseUrl}/stocks/SPY/bars?${histParams('iex')}`),
      probe(`${config.alpacaDataBaseUrl}/stocks/SPY/bars?${histParams('sip')}`),
      probe(`${dataOrigin()}/v1beta3/crypto/us/latest/quotes?symbols=BTC%2FUSD`),
      probe(`${dataOrigin()}/v1beta3/crypto/us/bars?${cryptoParams}`)
    ]);

    const notes: string[] = [];
    for (const [label, error] of [
      ['live IEX', iexLive],
      ['live SIP', sipLive],
      ['delayed SIP', delayedLive],
      ['historical IEX', iexHistorical],
      ['historical SIP', sipHistorical],
      ['crypto live', cryptoLive],
      ['crypto historical', cryptoHistorical]
    ] as const) {
      if (error && error.category !== 'NOT_ENTITLED') notes.push(`${label}: ${error.message}`);
    }

    return {
      checkedAt: new Date().toISOString(),
      configured: true,
      historical: {
        iex: capabilityState(iexHistorical),
        sip: capabilityState(sipHistorical),
        crypto_us: capabilityState(cryptoHistorical)
      },
      live: {
        iex: capabilityState(iexLive),
        sip: capabilityState(sipLive),
        delayed_sip: capabilityState(delayedLive),
        crypto_us: capabilityState(cryptoLive)
      },
      assetClasses: ['US_EQUITY', 'CRYPTO'],
      notes
    };
  }

  async latestQuote(request: LatestQuoteRequest): Promise<MarketQuote> {
    const symbol = request.symbol.trim().toUpperCase();
    if (!symbol) throw new Error('Quote symbol is required.');
    const assetClass = request.assetClass ?? 'US_EQUITY';

    let response: Response;
    let raw: Record<string, unknown> | undefined;
    let feed: string;

    if (assetClass === 'CRYPTO') {
      feed = 'crypto_us';
      response = await pacedFetch(`${dataOrigin()}/v1beta3/crypto/us/latest/quotes?symbols=${encodeURIComponent(symbol)}`);
      const payload = await response.json() as { quotes?: Record<string, Record<string, unknown>> };
      raw = payload.quotes?.[symbol];
    } else {
      feed = request.feed.trim() || config.alpacaLiveFeed || 'iex';
      response = await pacedFetch(`${config.alpacaDataBaseUrl}/stocks/${encodeURIComponent(symbol)}/quotes/latest?feed=${encodeURIComponent(feed)}`);
      const payload = await response.json() as { quote?: Record<string, unknown> };
      raw = payload.quote;
    }

    if (!raw) throw new AlpacaError('Alpaca returned no latest quote.', 'PROVIDER', response.status);
    const quote = parseQuote(symbol, feed, assetClass, raw);
    if (![quote.bidPrice, quote.bidSize, quote.askPrice, quote.askSize].every(Number.isFinite)) {
      throw new AlpacaError('Alpaca returned an invalid quote.', 'PROVIDER', response.status);
    }
    return quote;
  }

  async historicalBars(request: HistoricalBarsRequest): Promise<MarketBar[]> {
    const assetClass = request.assetClass ?? 'US_EQUITY';
    return assetClass === 'CRYPTO' ? this.cryptoBars(request) : this.stockBars(request);
  }

  async searchAssets(request: SearchAssetsRequest): Promise<MarketAsset[]> {
    const classes: MarketAssetClass[] = request.assetClass && request.assetClass !== 'ALL'
      ? [request.assetClass]
      : ['US_EQUITY', 'CRYPTO'];
    const catalogs = await Promise.all(classes.map(assetClass => this.loadAssets(assetClass)));
    const query = request.query.trim().toLowerCase();
    const limit = Math.max(1, Math.min(100, Math.floor(request.limit || 40)));
    return catalogs
      .flat()
      .filter(asset => !query || asset.symbol.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query))
      .sort((a, b) => assetRank(a, query) - assetRank(b, query) || a.symbol.localeCompare(b.symbol))
      .slice(0, limit);
  }

  private async stockBars(request: HistoricalBarsRequest): Promise<MarketBar[]> {
    const bars: MarketBar[] = [];
    let pageToken: string | null = null;
    do {
      const params = new URLSearchParams({
        timeframe: request.timeframe,
        start: request.start,
        end: request.end,
        feed: request.feed,
        adjustment: request.adjustmentMode,
        sort: 'asc',
        limit: '10000'
      });
      if (pageToken) params.set('page_token', pageToken);
      const response = await pacedFetch(`${config.alpacaDataBaseUrl}/stocks/${encodeURIComponent(request.symbol)}/bars?${params}`);
      const payload = await response.json() as { bars?: Record<string, unknown>[]; next_page_token?: string | null };
      for (const raw of payload.bars ?? []) bars.push(parseBar(raw));
      pageToken = payload.next_page_token ?? null;
    } while (pageToken);
    return bars;
  }

  private async cryptoBars(request: HistoricalBarsRequest): Promise<MarketBar[]> {
    const symbol = request.symbol.trim().toUpperCase();
    const bars: MarketBar[] = [];
    let pageToken: string | null = null;
    do {
      const params = new URLSearchParams({
        symbols: symbol,
        timeframe: request.timeframe,
        start: request.start,
        end: request.end,
        sort: 'asc',
        limit: '10000'
      });
      if (pageToken) params.set('page_token', pageToken);
      const response = await pacedFetch(`${dataOrigin()}/v1beta3/crypto/us/bars?${params}`);
      const payload = await response.json() as { bars?: Record<string, Record<string, unknown>[]>; next_page_token?: string | null };
      for (const raw of payload.bars?.[symbol] ?? []) bars.push(parseBar(raw));
      pageToken = payload.next_page_token ?? null;
    } while (pageToken);
    return bars;
  }

  private async loadAssets(assetClass: MarketAssetClass): Promise<MarketAsset[]> {
    const cached = this.assetCache.get(assetClass);
    if (cached && Date.now() - cached.loadedAt < 15 * 60_000) return cached.assets;

    const alpacaClass = assetClass === 'CRYPTO' ? 'crypto' : 'us_equity';
    const params = new URLSearchParams({ status: 'active', asset_class: alpacaClass });
    const response = await pacedFetch(`${config.alpacaTradingBaseUrl}/assets?${params}`);
    const payload = await response.json() as AlpacaAssetPayload[];
    const assets = payload
      .map(raw => parseAsset(raw, assetClass))
      .filter((asset): asset is MarketAsset => Boolean(asset));
    this.assetCache.set(assetClass, { loadedAt: Date.now(), assets });
    return assets;
  }
}

function assetRank(asset: MarketAsset, query: string): number {
  if (!query) {
    const popular = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'AMZN', 'TSLA', 'BTC/USD', 'ETH/USD'];
    const index = popular.indexOf(asset.symbol);
    return index >= 0 ? index : 1000;
  }
  const symbol = asset.symbol.toLowerCase();
  const name = asset.name.toLowerCase();
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 10;
  if (name.startsWith(query)) return 20;
  if (symbol.includes(query)) return 30;
  if (name.includes(query)) return 40;
  return 100;
}

export const alpacaProvider = new AlpacaProvider();
