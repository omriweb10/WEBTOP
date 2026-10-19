import { useEffect, type RefObject } from 'react';

export interface SwipeOptions {
  /** Finger moved toward the left edge. */
  onSwipeLeft: () => void;
  /** Finger moved toward the right edge. */
  onSwipeRight: () => void;
  /** Minimum horizontal travel in px. */
  threshold?: number;
  /** Element translated with the finger for direct-manipulation feedback. */
  feedbackRef?: RefObject<HTMLElement | null>;
}

/** Decides the gesture axis once the finger has moved far enough to tell. */
export function classifyGesture(dx: number, dy: number, slop = 10): 'horizontal' | 'vertical' | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical';
}

/**
 * Horizontal swipe detection that never fights vertical scrolling. The target is
 * styled `touch-action: pan-y`, so the browser keeps native inertial vertical scrolling
 * and cancels our pointer when it starts scrolling; we only act on horizontal drags.
 */
export function useSwipeNavigation(targetRef: RefObject<HTMLElement | null>, options: SwipeOptions): void {
  const { onSwipeLeft, onSwipeRight, threshold = 56, feedbackRef } = options;

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return undefined;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    let axis: 'horizontal' | 'vertical' | null = null;

    /** Moves (or resets) the feedback element. */
    const setOffset = (px: number, animate: boolean) => {
      const el = feedbackRef?.current;
      if (!el) return;
      el.style.transition = animate ? 'transform 180ms cubic-bezier(0.2, 0, 0, 1)' : 'none';
      el.style.transform = px ? `translateX(${px}px)` : '';
    };

    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      start = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId };
      axis = null;
    };

    const onMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      axis ??= classifyGesture(dx, dy);
      if (axis === 'vertical') {
        start = null;
        return;
      }
      // Damped follow so the content hints at the coming day change.
      if (axis === 'horizontal') setOffset(dx * 0.3, false);
    };

    const finish = (event: PointerEvent, cancelled: boolean) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const elapsed = Math.max(1, event.timeStamp - start.t);
      const fast = Math.abs(dx) / elapsed > 0.45 && Math.abs(dx) > threshold / 2;
      const wasHorizontal = axis === 'horizontal';
      start = null;
      axis = null;
      setOffset(0, true);
      if (cancelled || !wasHorizontal || (Math.abs(dx) < threshold && !fast)) return;
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    };

    const onUp = (event: PointerEvent) => finish(event, false);
    const onCancel = (event: PointerEvent) => finish(event, true);

    target.addEventListener('pointerdown', onDown, { passive: true });
    target.addEventListener('pointermove', onMove, { passive: true });
    target.addEventListener('pointerup', onUp, { passive: true });
    target.addEventListener('pointercancel', onCancel, { passive: true });
    return () => {
      target.removeEventListener('pointerdown', onDown);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onCancel);
    };
  }, [targetRef, onSwipeLeft, onSwipeRight, threshold, feedbackRef]);
}
