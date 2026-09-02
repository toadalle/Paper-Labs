import type { CapabilityState, MarketAsset, MarketAssetClass, MarketBar, MarketQuote } from '../../domain/types.js';

export interface MarketDataCapabilities {
  checkedAt: string | null;
  configured: boolean;
  historical: Record<string, CapabilityState>;
  live: Record<string, CapabilityState>;
  assetClasses: MarketAssetClass[];
  notes: string[];
}

export interface HistoricalBarsRequest {
  symbol: string;
  assetClass?: MarketAssetClass;
  timeframe: string;
  start: string;
  end: string;
  feed: string;
  adjustmentMode: string;
}

export interface LatestQuoteRequest {
  symbol: string;
  assetClass?: MarketAssetClass;
  feed: string;
}

export interface SearchAssetsRequest {
  query: string;
  assetClass?: MarketAssetClass | 'ALL';
  limit: number;
}

export interface MarketDataProvider {
  readonly id: string;
  capabilities(force?: boolean): Promise<MarketDataCapabilities>;
  historicalBars(request: HistoricalBarsRequest): Promise<MarketBar[]>;
  latestQuote(request: LatestQuoteRequest): Promise<MarketQuote>;
  searchAssets(request: SearchAssetsRequest): Promise<MarketAsset[]>;
}
