import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveShellMode, shellThresholds, shouldSelectionOpenInspector } from '../src/frontend/shell/responsive.js';

test('shell mode derives from useful panel capacity rather than device identity', () => {
  const thresholds = shellThresholds(16);
  assert.equal(thresholds.desktopMinPx, 1060);
  assert.equal(thresholds.narrowMaxPx, 704);
  assert.equal(deriveShellMode(1600), 'desktop');
  assert.equal(deriveShellMode(1024), 'constrained');
  assert.equal(deriveShellMode(390), 'narrow');
});

test('shell thresholds scale with root font size', () => {
  assert.equal(deriveShellMode(1100, 20), 'constrained');
  assert.equal(deriveShellMode(800, 20), 'narrow');
});

test('non-desktop focus modes open Inspector for deliberate selection', () => {
  assert.equal(shouldSelectionOpenInspector('desktop'), false);
  assert.equal(shouldSelectionOpenInspector('constrained'), true);
  assert.equal(shouldSelectionOpenInspector('narrow'), true);
});
