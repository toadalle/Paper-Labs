import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { config, alpacaConfigured } from '../infrastructure/config.js';
import { alpacaProvider } from '../infrastructure/market-data/alpaca.js';
import { Repository } from '../infrastructure/persistence/repository.js';
import { AuditService } from '../infrastructure/audit/audit-service.js';
import { logger } from '../infrastructure/logging/logger.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../domain/version.js';
import { ApiRouter } from './routes.js';
import { ResearchIntegrityService } from '../application/services/research-integrity-service.js';
import { MarketDataIntegrityService } from '../application/services/market-data-integrity-service.js';
import { createId } from '../domain/id.js';
import { text } from './http.js';

logger.info({ category: 'app', event: 'APP_STARTING', message: `${PRODUCT_NAME} ${PRODUCT_VERSION} starting.` });

let repository: Repository;
try {
  repository = new Repository();
  logger.info({ category: 'persistence', event: 'DATABASE_OPENED', message: 'SQLite repository opened.' });
} catch (error) {
  logger.fatal({ category: 'persistence', event: 'DATABASE_OPEN_FAILED', message: 'Unable to open SQLite repository.', error });
  throw error;
}

const audit = new AuditService(repository);
const researchIntegrity = new ResearchIntegrityService(repository, audit);
const marketDataIntegrity = new MarketDataIntegrityService(repository, researchIntegrity, logger);

try {
  const sweep = await marketDataIntegrity.verifyAll(createId('startup_integrity'));
  logger.info({
    category: 'market-data',
    event: 'MARKET_DATA_INTEGRITY_SWEEP_COMPLETED',
    message: `Verified ${sweep.checked} stored market-data snapshot artifact(s); ${sweep.compromised} compromised.`,
    context: { checked: sweep.checked, valid: sweep.valid, compromised: sweep.compromised }
  });
} catch (error) {
  logger.fatal({
    category: 'market-data',
    event: 'MARKET_DATA_INTEGRITY_SWEEP_FAILED',
    message: 'Unable to complete startup market-data integrity sweep.',
    error
  });
  repository.close();
  throw error;
}

const router = new ApiRouter(repository, alpacaProvider, audit, logger, marketDataIntegrity);

const server = createServer(async (req, res) => {
  if (await router.handle(req, res)) return;

  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;
    const isCompiledAsset = pathname.startsWith('/frontend/') || pathname.startsWith('/domain/');
    const base = isCompiledAsset ? join(process.cwd(), 'dist') : join(process.cwd(), 'public');
    const requested = pathname === '/' ? '/index.html' : pathname;
    const relative = normalize(requested).replace(/^[/\\]+/, '');
    const file = join(base, relative);
    if (!file.startsWith(base)) throw new Error('Invalid path.');
    await sendFile(res, file);
  } catch {
    if ((req.method ?? 'GET') === 'GET' && acceptsHtml(req.headers.accept)) {
      try {
        await sendFile(res, join(process.cwd(), 'public', 'index.html'));
        return;
      } catch {
        // Fall through to final 404.
      }
    }
    text(res, 404, 'Not found.');
  }
});

server.on('error', error => {
  logger.fatal({ category: 'server', event: 'PORT_BIND_FAILED', message: 'HTTP server failed.', error });
});

server.listen(config.port, config.host, () => {
  logger.info({
    category: 'server',
    event: 'SERVER_LISTENING',
    message: `${PRODUCT_NAME} ${PRODUCT_VERSION} listening at http://${config.host}:${config.port}`,
    context: { host: config.host, port: config.port }
  });
  logger.info({
    category: 'provider',
    event: alpacaConfigured() ? 'PROVIDER_CONFIGURED' : 'PROVIDER_NOT_CONFIGURED',
    message: `Alpaca is ${alpacaConfigured() ? 'configured' : 'not configured'}; historical feed ${config.alpacaHistoricalFeed.toUpperCase()}.`,
    context: { provider: 'alpaca', historicalFeed: config.alpacaHistoricalFeed }
  });
});

let closing = false;
function shutdown(): void {
  if (closing) return;
  closing = true;
  logger.info({ category: 'app', event: 'APP_SHUTTING_DOWN', message: 'Paper Lab shutting down.' });
  server.close(() => {
    repository.close();
    logger.info({ category: 'app', event: 'APP_STOPPED', message: 'Paper Lab stopped.' });
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', error => {
  logger.fatal({ category: 'process', event: 'UNHANDLED_REJECTION', message: 'Unhandled promise rejection.', error });
});
process.on('uncaughtException', error => {
  logger.fatal({ category: 'process', event: 'UNCAUGHT_EXCEPTION', message: 'Uncaught exception.', error });
  shutdown();
});

async function sendFile(res: import('node:http').ServerResponse, path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isFile()) throw new Error('Not a file.');
  const data = await readFile(path);
  const ext = extname(path);
  const contentType =
    ext === '.html' ? 'text/html; charset=utf-8' :
    ext === '.css' ? 'text/css; charset=utf-8' :
    ext === '.js' ? 'text/javascript; charset=utf-8' :
    ext === '.json' ? 'application/json; charset=utf-8' :
    'application/octet-stream';
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': data.length,
    'cache-control': 'no-store'
  });
  res.end(data);
}

function acceptsHtml(value: string | string[] | undefined): boolean {
  if (!value) return true;
  const textValue = Array.isArray(value) ? value.join(',') : value;
  return textValue.includes('text/html') || textValue.includes('*/*');
}
