import type { IncomingMessage, ServerResponse } from 'node:http';

export function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

export function text(res: ServerResponse, status: number, value: string, type = 'text/plain; charset=utf-8'): void {
  res.writeHead(status, {
    'content-type': type,
    'content-length': Buffer.byteLength(value),
    'cache-control': 'no-store'
  });
  res.end(value);
}

export async function readJson(req: IncomingMessage, maxBytes = 1_000_000): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON body must be an object.');
  return value as Record<string, unknown>;
}
