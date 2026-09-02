import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogInput {
  category: string;
  event: string;
  message: string;
  correlationId?: string | null;
  requestId?: string | null;
  entityId?: string | null;
  arenaId?: string | null;
  experienceId?: string | null;
  evolutionRunId?: string | null;
  snapshotId?: string | null;
  durationMs?: number | null;
  error?: unknown;
  context?: Record<string, unknown>;
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  category: string;
  event: string;
  message: string;
  correlationId: string | null;
  requestId: string | null;
  entityId: string | null;
  arenaId: string | null;
  experienceId: string | null;
  evolutionRunId: string | null;
  snapshotId: string | null;
  durationMs: number | null;
  error: { name: string; message: string; stack: string | null; code: string | null } | null;
  context: Record<string, unknown>;
}

const sensitiveKey = /(api[-_]?key|secret|authorization|token|cookie|password|credential)/i;

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[max-depth]';
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(item => safeValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sensitiveKey.test(key) ? '[redacted]' : safeValue(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}

function serializeError(error: unknown): LogRecord['error'] {
  if (!error) return null;
  if (error instanceof Error) {
    const withCode = error as Error & { code?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      code: typeof withCode.code === 'string' ? withCode.code : null
    };
  }
  return { name: 'Error', message: String(error), stack: null, code: null };
}

export class Logger {
  constructor(private readonly root = 'data/logs') {}

  debug(input: LogInput): void { this.write('DEBUG', input); }
  info(input: LogInput): void { this.write('INFO', input); }
  warn(input: LogInput): void { this.write('WARN', input); }
  error(input: LogInput): void { this.write('ERROR', input); }
  fatal(input: LogInput): void { this.write('FATAL', input); }

  listRecent(limit = 300): LogRecord[] {
    const safeLimit = Math.max(1, Math.min(2000, Math.floor(limit)));
    if (!existsSync(this.root)) return [];
    const files = readdirSync(this.root)
      .filter(name => name.startsWith('paper-lab-') && name.endsWith('.ndjson'))
      .sort()
      .reverse();
    const records: LogRecord[] = [];
    for (const file of files) {
      const text = readFileSync(join(this.root, file), 'utf8');
      const lines = text.split(/\r?\n/).filter(Boolean).reverse();
      for (const line of lines) {
        try { records.push(JSON.parse(line) as LogRecord); } catch { /* ignore malformed diagnostic line */ }
        if (records.length >= safeLimit) return records;
      }
    }
    return records;
  }

  private write(level: LogLevel, input: LogInput): void {
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      category: input.category,
      event: input.event,
      message: input.message,
      correlationId: input.correlationId ?? null,
      requestId: input.requestId ?? null,
      entityId: input.entityId ?? null,
      arenaId: input.arenaId ?? null,
      experienceId: input.experienceId ?? null,
      evolutionRunId: input.evolutionRunId ?? null,
      snapshotId: input.snapshotId ?? null,
      durationMs: input.durationMs ?? null,
      error: serializeError(input.error),
      context: (safeValue(input.context ?? {}) as Record<string, unknown>)
    };
    const line = `${JSON.stringify(record)}\n`;
    const consoleLine = `[${record.timestamp}] ${record.level} ${record.category}/${record.event}: ${record.message}`;
    if (level === 'ERROR' || level === 'FATAL') console.error(consoleLine);
    else if (level === 'WARN') console.warn(consoleLine);
    else console.log(consoleLine);

    try {
      const date = record.timestamp.slice(0, 10);
      const path = join(this.root, `paper-lab-${date}.ndjson`);
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, line, 'utf8');
    } catch (error) {
      console.error(`[logger/file-sink-failed] ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const logger = new Logger();
