import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildBootstrap } from '../application/bootstrap.js';
import { isLiveRange, resolveLiveChartQuery } from '../application/live/chart-query.js';
import { EntityService } from '../application/services/entity-service.js';
import { ArenaService } from '../application/services/arena-service.js';
import { EvaluationService } from '../application/services/evaluation-service.js';
import { createId } from '../domain/id.js';
import type { EntityTraits, MarketAssetClass } from '../domain/types.js';
import { strategyRegistry } from '../domain/strategy/registry.js';
import type { AuditService } from '../infrastructure/audit/audit-service.js';
import type { Logger } from '../infrastructure/logging/logger.js';
import type { MarketDataCapabilities, MarketDataProvider } from '../infrastructure/market-data/provider.js';
import type { Repository } from '../infrastructure/persistence/repository.js';
import type { MarketDataIntegrityService } from '../application/services/market-data-integrity-service.js';
import { NotificationService } from '../application/notifications/notification-service.js';
import type { NotificationSeverity } from '../domain/types.js';
import { MarketDataSnapshotService } from '../infrastructure/market-data/snapshots.js';
import { config } from '../infrastructure/config.js';
import { PortableImportService } from '../application/import/import-service.js';
import type { ImportContext } from '../application/import/types.js';
import { json, readJson } from './http.js';

const uncheckedProvider: MarketDataCapabilities = {
  checkedAt: null,
  configured: false,
  historical: { iex: 'UNKNOWN', sip: 'UNKNOWN', crypto_us: 'UNKNOWN' },
  live: { iex: 'UNKNOWN', sip: 'UNKNOWN', delayed_sip: 'UNKNOWN', crypto_us: 'UNKNOWN' },
  assetClasses: ['US_EQUITY', 'CRYPTO'],
  notes: ['Provider capabilities have not been probed.']
};

export class ApiRouter {
  private providerCache: MarketDataCapabilities = structuredClone(uncheckedProvider);
  private readonly entityService: EntityService;
  private readonly arenaService: ArenaService;
  private readonly evaluationService: EvaluationService;
  private readonly notifications: NotificationService;
  private readonly portableImport: PortableImportService;

  constructor(
    private readonly repository: Repository,
    private readonly provider: MarketDataProvider,
    private readonly audit: AuditService,
    private readonly logger: Logger,
    private readonly marketDataIntegrity: MarketDataIntegrityService
  ) {
    this.entityService = new EntityService(repository, audit);
    const snapshots = new MarketDataSnapshotService(repository, provider, audit);
    this.arenaService = new ArenaService(repository, snapshots, audit);
    this.evaluationService = new EvaluationService(repository, snapshots, audit);
    this.notifications = new NotificationService(repository);
    this.portableImport = new PortableImportService(repository, this.entityService, this.arenaService, audit, provider.id, config.alpacaHistoricalFeed);
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (!url.pathname.startsWith('/api/')) return false;

    const method = req.method ?? 'GET';
    const requestId = createId('request');
    const correlationId = header(req, 'x-correlation-id') ?? requestId;
    const started = Date.now();
    this.logger.debug({
      category: 'http',
      event: 'REQUEST_STARTED',
      message: `${method} ${url.pathname}`,
      requestId,
      correlationId,
      context: { method, pathname: url.pathname }
    });

    try {
      if (method === 'GET' && url.pathname === '/api/bootstrap') {
        json(res, 200, buildBootstrap(this.repository, this.providerCache, this.audit.verify()));
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/import/schema') {
        json(res, 200, this.portableImport.schema());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const importSchemaMatch = /^\/api\/import\/schema\/([^/]+)$/.exec(url.pathname);
      if (method === 'GET' && importSchemaMatch) {
        json(res, 200, this.portableImport.schema(decodeURIComponent(importSchemaMatch[1]!)));
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/import/preview') {
        const body = await readJson(req);
        const rawContext = body.context;
        if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) throw new Error('Import preview requires context.');
        const contextValue = rawContext as Record<string, unknown>;
        const context: ImportContext = {
          surface: String(contextValue.surface ?? '') as ImportContext['surface'],
          targetId: typeof contextValue.targetId === 'string' ? contextValue.targetId : null
        };
        const plan = this.portableImport.preview(body.document, context);
        json(res, 200, plan);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/import/apply') {
        const body = await readJson(req);
        const planId = String(body.planId ?? '').trim();
        const planHash = String(body.planHash ?? '').trim();
        if (!planId || !planHash) throw new Error('Import apply requires planId and planHash.');
        const result = await this.portableImport.apply(planId, planHash, correlationId);
        json(res, 200, result);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/provider/probe') {
        this.providerCache = await this.provider.capabilities(true);
        json(res, 200, this.providerCache);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/market/assets') {
        const query = (url.searchParams.get('query') ?? '').trim();
        const assetClass = parseAssetClass(url.searchParams.get('assetClass'), true);
        const rawLimit = Number(url.searchParams.get('limit') ?? '40');
        const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 40;
        const assets = await this.provider.searchAssets({ query, assetClass, limit });
        json(res, 200, { assets });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/market/quote') {
        const symbol = (url.searchParams.get('symbol') ?? '').trim().toUpperCase();
        const assetClass = parseAssetClass(url.searchParams.get('assetClass'), false);
        const feed = assetClass === 'CRYPTO' ? 'crypto_us' : (url.searchParams.get('feed') ?? 'iex').trim();
        if (!symbol) throw new Error('Quote symbol is required.');
        const quote = await this.provider.latestQuote({ symbol, feed, assetClass });
        json(res, 200, { quote, capability: this.providerCache.live[feed] ?? 'UNKNOWN' });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/market/chart') {
        const symbol = (url.searchParams.get('symbol') ?? '').trim().toUpperCase();
        const assetClass = parseAssetClass(url.searchParams.get('assetClass'), false);
        const rangeValue = (url.searchParams.get('range') ?? '1M').toUpperCase();
        const feed = assetClass === 'CRYPTO' ? 'crypto_us' : (url.searchParams.get('feed') ?? 'iex').trim();
        if (!symbol) throw new Error('Chart symbol is required.');
        if (!isLiveRange(rangeValue)) throw new Error('Unsupported chart range.');
        const query = resolveLiveChartQuery(rangeValue, assetClass);
        const bars = await this.provider.historicalBars({
          symbol,
          assetClass,
          timeframe: query.timeframe,
          start: query.start,
          end: query.end,
          feed,
          adjustmentMode: assetClass === 'CRYPTO' ? 'raw' : 'split'
        });
        json(res, 200, {
          symbol,
          assetClass,
          provider: this.provider.id,
          feed,
          range: query.range,
          timeframe: query.timeframe,
          requestedStart: query.start,
          requestedEnd: query.end,
          actualStart: bars[0]?.time ?? null,
          actualEnd: bars.at(-1)?.time ?? null,
          bars
        });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/notifications') {
        const limitRaw = Number(url.searchParams.get('limit') ?? '250');
        const offsetRaw = Number(url.searchParams.get('offset') ?? '0');
        const limit = Number.isFinite(limitRaw) ? limitRaw : 250;
        const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;
        json(res, 200, { notifications: this.repository.listNotifications(limit, offset), total: this.repository.countNotifications() });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/notifications') {
        const body = await readJson(req);
        const severity = String(body.severity ?? 'INFO').toUpperCase() as NotificationSeverity;
        if (!['SUCCESS','INFO','WARNING','ERROR','CRITICAL'].includes(severity)) throw new Error('Unsupported notification severity.');
        const title = String(body.title ?? '').trim();
        const messageText = String(body.message ?? '').trim();
        const category = typeof body.category === 'string' ? body.category : 'general';
        const target = body.target && typeof body.target === 'object' ? body.target as { type: string; id: string | null; route: string | null } : null;
        const notification = this.notifications.create({ severity, category, title, message: messageText, correlationId, target });
        json(res, 201, notification);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/notifications/seen') {
        const changed = this.notifications.markAllSeen();
        json(res, 200, { changed });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const notificationMatch = /^\/api\/notifications\/([^/]+)$/.exec(url.pathname);
      if (method === 'PATCH' && notificationMatch) {
        const body = await readJson(req);
        const id = decodeURIComponent(notificationMatch[1]!);
        const notification = body.dismissed === true
          ? this.notifications.markDismissed(id)
          : body.seen === true
            ? this.notifications.markSeen(id)
            : (() => { throw new Error('Notification patch requires seen or dismissed.'); })();
        json(res, 200, notification);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/console/logs') {
        const rawLimit = Number(url.searchParams.get('limit') ?? '400');
        const limit = Number.isFinite(rawLimit) ? rawLimit : 400;
        json(res, 200, { logs: this.logger.listRecent(limit) });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/audit/events') {
        const rawLimit = Number(url.searchParams.get('limit') ?? '400');
        const limit = Math.max(1, Math.min(1000, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 400));
        json(res, 200, { events: this.repository.listAuditEvents().slice(-limit).reverse() });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/console/overview') {
        const integrity = this.audit.verify();
        json(res, 200, {
          version: buildBootstrap(this.repository, this.providerCache, integrity).product.version,
          uptimeSeconds: Math.round(process.uptime()),
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          provider: this.providerCache,
          auditIntegrity: integrity,
          counts: {
            notifications: this.repository.countNotifications(),
            auditEvents: this.repository.listAuditEvents().length,
            snapshots: this.repository.count('market_data_snapshot'),
            experiences: this.repository.count('experience')
          }
        });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/strategies') {
        json(res, 200, { strategies: strategyRegistry.list().map(definition => ({
          strategyType: definition.strategyType,
          strategyVersion: definition.strategyVersion,
          displayName: definition.displayName,
          traitDefinitions: definition.traitDefinitions
        })) });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/entities') {
        json(res, 200, this.repository.listEntities());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/entities') {
        // Body is intentionally ignored in V1 quick-create. The server owns default naming.
        await readJson(req);
        const entity = this.entityService.quickCreate(correlationId);
        json(res, 201, entity);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const entityMatch = /^\/api\/entities\/([^/]+)$/.exec(url.pathname);
      if (method === 'GET' && entityMatch) {
        const entity = this.repository.getEntity(decodeURIComponent(entityMatch[1]!));
        if (!entity) {
          json(res, 404, { error: 'Entity not found.' });
          return this.complete(method, url.pathname, requestId, correlationId, started, true);
        }
        json(res, 200, entity);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'PATCH' && entityMatch) {
        const body = await readJson(req);
        const input: { name?: string; family?: string | null } = {};
        if ('name' in body) {
          if (typeof body.name !== 'string') throw new Error('Entity name must be a string.');
          input.name = body.name;
        }
        if ('family' in body) {
          if (body.family !== null && typeof body.family !== 'string') throw new Error('Entity family must be a string or null.');
          input.family = body.family as string | null;
        }
        if (!('name' in input) && !('family' in input)) throw new Error('No mutable Entity metadata was supplied.');
        const entity = this.entityService.updateMetadata(decodeURIComponent(entityMatch[1]!), input, correlationId);
        json(res, 200, entity);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const entityConfigurationMatch = /^\/api\/entities\/([^/]+)\/configuration$/.exec(url.pathname);
      if (method === 'PATCH' && entityConfigurationMatch) {
        const body = await readJson(req);
        const strategyType = String(body.strategyType ?? '').trim();
        const strategyVersion = body.strategyVersion == null ? null : Number(body.strategyVersion);
        const traits = (body.traits && typeof body.traits === 'object' ? body.traits : {}) as EntityTraits;
        const entity = this.entityService.configureDraft(decodeURIComponent(entityConfigurationMatch[1]!), { strategyType, strategyVersion, traits }, correlationId);
        json(res, 200, entity);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const entityFinalizeMatch = /^\/api\/entities\/([^/]+)\/configuration\/finalize$/.exec(url.pathname);
      if (method === 'POST' && entityFinalizeMatch) {
        const body = await readJson(req);
        const input: { strategyType?: string; strategyVersion?: number | null; traits?: EntityTraits } = {};
        if (typeof body.strategyType === 'string') input.strategyType = body.strategyType;
        if (body.strategyVersion != null) input.strategyVersion = Number(body.strategyVersion);
        if (body.traits && typeof body.traits === 'object') input.traits = body.traits as EntityTraits;
        const entity = this.entityService.finalizeConfiguration(decodeURIComponent(entityFinalizeMatch[1]!), input, correlationId);
        json(res, 200, entity);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const retireEntityMatch = /^\/api\/entities\/([^/]+)\/retire$/.exec(url.pathname);
      if (method === 'POST' && retireEntityMatch) {
        await readJson(req);
        const entity = this.entityService.retire(decodeURIComponent(retireEntityMatch[1]!), correlationId);
        json(res, 200, entity);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'DELETE' && entityMatch) {
        const tombstone = this.entityService.deleteRetired(decodeURIComponent(entityMatch[1]!), correlationId);
        json(res, 200, { deletedId: tombstone.entityId, tombstone });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/arenas') {
        json(res, 200, this.repository.listArenas());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/arenas') {
        const body = await readJson(req);
        const arenaInput: import('../application/services/arena-service.js').CreateArenaInput = {
          name: String(body.name ?? ''),
          symbol: String(body.symbol ?? ''),
          start: String(body.start ?? ''),
          end: String(body.end ?? ''),
          feed: config.alpacaHistoricalFeed,
          baseArenaId: typeof body.baseArenaId === 'string' && body.baseArenaId.trim() ? body.baseArenaId.trim() : null
        };
        if (typeof body.timeframe === 'string') arenaInput.timeframe = body.timeframe;
        if (body.initialCapital != null) arenaInput.initialCapital = Number(body.initialCapital);
        if (body.warmupBars != null) arenaInput.warmupBars = Number(body.warmupBars);
        if (body.commissionPerTrade != null) arenaInput.commissionPerTrade = Number(body.commissionPerTrade);
        if (body.slippageBps != null) arenaInput.slippageBps = Number(body.slippageBps);
        if (body.rewardLambda != null) arenaInput.rewardLambda = Number(body.rewardLambda);
        if (body.maxDrawdownGate != null) arenaInput.maxDrawdownGate = Number(body.maxDrawdownGate);
        if (body.minimumTradeCount != null) arenaInput.minimumTradeCount = Number(body.minimumTradeCount);
        const arena = await this.arenaService.create(arenaInput, correlationId);
        json(res, 201, arena);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/evaluation-runs') {
        json(res, 200, this.repository.listEvaluationRuns());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/evaluations') {
        const body = await readJson(req);
        const entityId = String(body.entityId ?? '').trim();
        const arenaId = String(body.arenaId ?? '').trim();
        if (!entityId || !arenaId) throw new Error('Evaluation requires entityId and arenaId.');
        const result = await this.evaluationService.run(entityId, arenaId, correlationId);
        json(res, 201, result);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const cancelEvaluationMatch = /^\/api\/evaluation-runs\/([^/]+)\/cancel$/.exec(url.pathname);
      if (method === 'POST' && cancelEvaluationMatch) {
        await readJson(req);
        const run = this.evaluationService.cancel(decodeURIComponent(cancelEvaluationMatch[1]!), correlationId);
        json(res, 200, run);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/experiences') {
        json(res, 200, this.repository.listExperiences());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      const experienceMatch = /^\/api\/experiences\/([^/]+)$/.exec(url.pathname);
      if (method === 'GET' && experienceMatch) {
        const experience = this.repository.getExperience(decodeURIComponent(experienceMatch[1]!));
        if (!experience) throw new Error('Experience not found.');
        const events = this.repository.listExperienceEventsByExperience(experience.id);
        const trace = experience.traceId ? this.repository.getExperienceTrace(experience.traceId) : null;
        json(res, 200, { experience, events, trace });
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/snapshots') {
        json(res, 200, this.repository.listMarketDataSnapshots());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/evolution-runs') {
        json(res, 200, this.repository.listEvolutionRuns());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/audit/integrity') {
        json(res, 200, this.audit.verify());
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'POST' && url.pathname === '/api/market-data/integrity/verify') {
        const result = await this.marketDataIntegrity.verifyAll(correlationId);
        this.notifications.create({
          severity: result.compromised > 0 ? 'WARNING' : 'SUCCESS',
          category: 'integrity',
          title: result.compromised > 0 ? 'Market-data integrity warning' : 'Market-data integrity verified',
          message: `Checked ${result.checked} snapshot artifact(s); ${result.compromised} compromised.`,
          correlationId,
          target: { type: 'console', id: 'diagnostics', route: '/console?view=diagnostics' }
        });
        json(res, 200, result);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      if (method === 'GET' && url.pathname === '/api/diagnostics') {
        const integrity = this.audit.verify();
        const bootstrap = buildBootstrap(this.repository, this.providerCache, integrity);
        const payload = {
          manifest: {
            generatedAt: new Date().toISOString(),
            product: bootstrap.product,
            format: 'paper-lab-diagnostics-json-v1'
          },
          system: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            uptimeSeconds: Math.round(process.uptime())
          },
          counts: bootstrap.counts,
          providerCapabilities: this.providerCache,
          auditIntegrity: integrity,
          recentAuditEvents: this.repository.listAuditEvents().slice(-100)
        };
        this.audit.record({
          eventType: 'DIAGNOSTICS_EXPORTED',
          actor: { type: 'USER', id: null },
          subject: { type: 'Project', id: 'paper-lab' },
          correlationId,
          summary: 'Generated sanitized diagnostics payload.',
          details: { format: 'json-v1' }
        });
        json(res, 200, payload);
        return this.complete(method, url.pathname, requestId, correlationId, started, true);
      }

      json(res, 404, { error: 'API route not found.' });
      return this.complete(method, url.pathname, requestId, correlationId, started, true);
    } catch (error) {
      this.logger.error({
        category: 'http',
        event: 'REQUEST_FAILED',
        message: `${method} ${url.pathname} failed.`,
        requestId,
        correlationId,
        durationMs: Date.now() - started,
        error,
        context: { method, pathname: url.pathname }
      });
      json(res, 400, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  }

  private complete(
    method: string,
    pathname: string,
    requestId: string,
    correlationId: string,
    started: number,
    handled: true
  ): true {
    this.logger.debug({
      category: 'http',
      event: 'REQUEST_COMPLETED',
      message: `${method} ${pathname} completed.`,
      requestId,
      correlationId,
      durationMs: Date.now() - started,
      context: { method, pathname }
    });
    return handled;
  }
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseAssetClass(value: string | null, allowAll: true): MarketAssetClass | 'ALL';
function parseAssetClass(value: string | null, allowAll: false): MarketAssetClass;
function parseAssetClass(value: string | null, allowAll: boolean): MarketAssetClass | 'ALL' {
  const normalized = (value ?? 'US_EQUITY').trim().toUpperCase();
  if (allowAll && normalized === 'ALL') return 'ALL';
  if (normalized === 'CRYPTO') return 'CRYPTO';
  if (normalized === 'US_EQUITY' || normalized === 'EQUITY' || normalized === 'STOCK') return 'US_EQUITY';
  throw new Error('Unsupported market asset class.');
}
