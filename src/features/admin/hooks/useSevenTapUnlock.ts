import { useCallback, useRef } from 'react';
import { toast } from '../../../store/uiStore';
import { EMPTY_TAP_SEQUENCE, registerTap, type TapSequence } from '../domain/tapUnlock';
import { currentEditModeBlocker } from '../editCapabilities';
import { useEditModeStore } from '../editModeStore';

/**
 * Returns a tap handler for the screen title. Seven rapid taps turn edit mode on at once
 * (no code or confirmation). Nothing is shown before that, so normal viewing stays free
 * of edit affordances.
 */
export function useSevenTapUnlock(): () => void {
  const sequence = useRef<TapSequence>(EMPTY_TAP_SEQUENCE);

  return useCallback(() => {
    const { sequence: next, triggered } = registerTap(sequence.current, performance.now());
    sequence.current = next;
    if (!triggered) return;
    const state = useEditModeStore.getState();
    if (state.unlocked) {
      toast('מצב העריכה כבר פעיל');
      return;
    }
    const blocker = currentEditModeBlocker();
    if (blocker) {
      toast(blocker, { tone: 'error' });
      return;
    }
    state.enable();
    toast('מצב עריכה הופעל', { tone: 'success' });
  }, []);
}
