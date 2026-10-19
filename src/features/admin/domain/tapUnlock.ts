/**
 * Pure detector for the hidden edit-mode gesture: N rapid taps on the screen title.
 * Kept free of timers/DOM so it can be unit-tested with synthetic timestamps.
 */

export interface TapSequence {
  count: number;
  lastTapAt: number;
}

export interface TapRule {
  /** Taps required to trigger. */
  required: number;
  /** Maximum milliseconds allowed between consecutive taps. */
  maxGapMs: number;
}

export const EDIT_MODE_TAP_RULE: TapRule = { required: 7, maxGapMs: 700 };

export const EMPTY_TAP_SEQUENCE: TapSequence = { count: 0, lastTapAt: Number.NEGATIVE_INFINITY };

/**
 * Registers a tap at `now`. A slow tap restarts the sequence at 1; reaching the
 * required count triggers and resets the sequence so the gesture can repeat.
 */
export function registerTap(
  sequence: TapSequence,
  now: number,
  rule: TapRule = EDIT_MODE_TAP_RULE,
): { sequence: TapSequence; triggered: boolean } {
  const continues = now - sequence.lastTapAt <= rule.maxGapMs;
  const count = continues ? sequence.count + 1 : 1;
  if (count >= rule.required) return { sequence: EMPTY_TAP_SEQUENCE, triggered: true };
  return { sequence: { count, lastTapAt: now }, triggered: false };
}
