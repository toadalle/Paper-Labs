import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Logger } from '../src/infrastructure/logging/logger.js';

test('structured logger redacts sensitive context keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-log-'));
  const logger = new Logger(dir);
  try {
    logger.info({ category: 'test', event: 'SAFE', message: 'hello', context: { symbol: 'SPY', apiKey: 'should-not-appear', nested: { secret: 'hidden' } } });
    const date = new Date().toISOString().slice(0, 10);
    const text = readFileSync(join(dir, `paper-lab-${date}.ndjson`), 'utf8');
    assert.match(text, /SPY/);
    assert.doesNotMatch(text, /should-not-appear|hidden/);
    assert.match(text, /\[redacted\]/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('file sink failure is best-effort and does not throw', () => {
  const dir = mkdtempSync(join(tmpdir(), 'paper-labs-log-'));
  const file = join(dir, 'not-a-directory');
  writeFileSync(file, 'x');
  const logger = new Logger(file);
  try {
    assert.doesNotThrow(() => logger.warn({ category: 'test', event: 'FALLBACK', message: 'fallback' }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
