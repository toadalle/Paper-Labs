function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function integer(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const config = Object.freeze({
  host: env('HOST', '127.0.0.1'),
  port: integer('PORT', 3000),
  alpacaApiKey: env('ALPACA_API_KEY'),
  alpacaSecretKey: env('ALPACA_SECRET_KEY'),
  alpacaTradingBaseUrl: env('ALPACA_TRADING_BASE_URL', 'https://paper-api.alpaca.markets/v2').replace(/\/+$/, ''),
  alpacaDataBaseUrl: env('ALPACA_DATA_BASE_URL', 'https://data.alpaca.markets/v2').replace(/\/+$/, ''),
  alpacaLiveFeed: env('ALPACA_LIVE_FEED', 'auto'),
  alpacaHistoricalFeed: env('ALPACA_HISTORICAL_FEED', 'iex'),
  alpacaMinRequestIntervalMs: integer('ALPACA_MIN_REQUEST_INTERVAL_MS', 100)
});

export function alpacaConfigured(): boolean {
  return Boolean(config.alpacaApiKey && config.alpacaSecretKey);
}
