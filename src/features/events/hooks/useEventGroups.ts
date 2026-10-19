import { useMemo } from 'react';
import { useEventsStore, usePresetsStore, useProfileStore } from '../../../store/dataStores';
import { eventGroups } from '../domain/eventOps';

/**
 * Class/study-group names offered for events: the class name, every subject preset and
 * any group already used by an event (so imported data never loses its filter value).
 */
export function useEventGroups(): string[] {
  const className = useProfileStore((state) => state.value.className);
  const presets = usePresetsStore((state) => state.value);
  const events = useEventsStore((state) => state.value);
  return useMemo(() => {
    const names = [className, ...presets.map((p) => p.subject), ...eventGroups(events)];
    return [...new Set(names.filter(Boolean))];
  }, [className, presets, events]);
}
