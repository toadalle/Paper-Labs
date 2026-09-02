import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from '../src/infrastructure/hash.js';

test('canonical JSON hashes object keys deterministically', () => {
  const left = canonicalJson({ z: 1, nested: { b: 2, a: 1 } });
  const right = canonicalJson({ nested: { a: 1, b: 2 }, z: 1 });
  assert.equal(left, right);
  assert.equal(sha256(left), sha256(right));
});
