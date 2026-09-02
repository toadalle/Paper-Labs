import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFlyoutPosition } from '../src/frontend/shared/flyout.js';

const trigger = { left: 900, top: 100, right: 930, bottom: 130, width: 30, height: 30 };

test('flyout clamps to the viewport instead of overflowing the right edge', () => {
  const position = computeFlyoutPosition(trigger, 272, 220, 1024, 768);
  assert.equal(position.left, 658);
  assert.equal(position.top, 136);
});

test('flyout flips above the trigger when there is not enough room below', () => {
  const lowTrigger = { left: 400, top: 690, right: 430, bottom: 720, width: 30, height: 30 };
  const position = computeFlyoutPosition(lowTrigger, 240, 180, 800, 760);
  assert.equal(position.top, 504);
});
