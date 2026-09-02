export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface FlyoutPosition {
  left: number;
  top: number;
}

export function computeFlyoutPosition(
  trigger: RectLike,
  flyoutWidth: number,
  flyoutHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  gap = 6,
  margin = 8
): FlyoutPosition {
  const safeWidth = Math.max(1, flyoutWidth);
  const safeHeight = Math.max(1, flyoutHeight);
  const maxLeft = Math.max(margin, viewportWidth - safeWidth - margin);
  const preferredLeft = trigger.right - safeWidth;
  const left = Math.max(margin, Math.min(maxLeft, preferredLeft));

  const below = trigger.bottom + gap;
  const above = trigger.top - gap - safeHeight;
  const top = below + safeHeight <= viewportHeight - margin
    ? below
    : Math.max(margin, above);

  return { left, top };
}

export function placeAnchoredFlyout(
  trigger: HTMLElement,
  flyout: HTMLElement,
  options: { gap?: number; margin?: number; matchTriggerWidth?: boolean } = {}
): void {
  const triggerRect = trigger.getBoundingClientRect();
  if (options.matchTriggerWidth) flyout.style.width = `${Math.max(180, triggerRect.width)}px`;
  const flyoutRect = flyout.getBoundingClientRect();
  const position = computeFlyoutPosition(
    triggerRect,
    flyoutRect.width,
    flyoutRect.height,
    window.innerWidth,
    window.innerHeight,
    options.gap ?? 6,
    options.margin ?? 8
  );
  flyout.style.position = 'fixed';
  flyout.style.left = `${Math.round(position.left)}px`;
  flyout.style.top = `${Math.round(position.top)}px`;
  flyout.style.right = 'auto';
}
