export type ShellMode = 'desktop' | 'constrained' | 'narrow';
export type ShellSurface = 'OBJECTS' | 'WORKSPACE' | 'INSPECTOR';

const OBJECTS_MIN_REM = 13.75;
const WORKSPACE_MIN_REM = 35;
const INSPECTOR_MIN_REM = 17.5;
const NARROW_WORKSPACE_ALLOWANCE_REM = 9;

export function shellThresholds(rootFontPx = 16): { desktopMinPx: number; narrowMaxPx: number } {
  const safeRoot = Number.isFinite(rootFontPx) && rootFontPx > 0 ? rootFontPx : 16;
  return {
    desktopMinPx: (OBJECTS_MIN_REM + WORKSPACE_MIN_REM + INSPECTOR_MIN_REM) * safeRoot,
    narrowMaxPx: (WORKSPACE_MIN_REM + NARROW_WORKSPACE_ALLOWANCE_REM) * safeRoot
  };
}

export function deriveShellMode(availableWidthPx: number, rootFontPx = 16): ShellMode {
  const width = Number.isFinite(availableWidthPx) ? Math.max(0, availableWidthPx) : 0;
  const thresholds = shellThresholds(rootFontPx);
  if (width >= thresholds.desktopMinPx) return 'desktop';
  if (width >= thresholds.narrowMaxPx) return 'constrained';
  return 'narrow';
}

export function shouldSelectionOpenInspector(mode: ShellMode): boolean {
  return mode !== 'desktop';
}
