/** Student Card section: routes, the side-menu entry, its screens and back navigation. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAV_ITEMS } from '../../src/app/navigation';
import { goBack, PLACEHOLDER_IDS, parseHash, routeToHash } from '../../src/app/router';
import { STUDENT_CARD_ENTRIES, STUDENT_CARD_ROUTE } from '../../src/features/studentCard/domain/studentCardEntries';

/** Sets the location hash and waits for the router to see the change. */
async function goTo(hash: string): Promise<void> {
  const changed = new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }));
  window.location.hash = hash;
  await changed;
}

describe('Student Card routes', () => {
  it('parses and serialises the section and its timetable screen', () => {
    expect(parseHash('#/student-card')).toEqual({ name: 'studentCard' });
    expect(parseHash('#/student-card/timetable')).toEqual({ name: 'studentCard', section: 'timetable' });
    expect(parseHash('#/student-card/unknown')).toEqual({ name: 'studentCard' });
    expect(routeToHash({ name: 'studentCard' })).toBe('#/student-card');
    expect(routeToHash({ name: 'studentCard', section: 'timetable' })).toBe('#/student-card/timetable');
  });

  it('replaces the old placeholder, keeping its link working', () => {
    expect(PLACEHOLDER_IDS).not.toContain('student-card');
    expect(parseHash('#/page/student-card')).toEqual({ name: 'studentCard' });
  });

  it('is reachable from the side menu, which stays highlighted on its screens', () => {
    const item = NAV_ITEMS.find((entry) => entry.label === 'כרטיס תלמיד');
    expect(item?.route).toEqual(STUDENT_CARD_ROUTE);
    expect(item?.matches({ name: 'studentCard' })).toBe(true);
    expect(item?.matches({ name: 'studentCard', section: 'timetable' })).toBe(true);
    expect(item?.matches({ name: 'schedule', tab: 'timetable' })).toBe(false);
  });

  it('lists only screens that exist, each with a valid route', () => {
    expect(STUDENT_CARD_ENTRIES.map((entry) => entry.label)).toEqual(['מערכת שעות']);
    for (const entry of STUDENT_CARD_ENTRIES) expect(parseHash(routeToHash(entry.route))).toEqual(entry.route);
  });
});

describe('back navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('steps back through history when the user came from the parent screen', async () => {
    await goTo('#/student-card');
    await goTo('#/student-card/timetable');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    goBack(STUDENT_CARD_ROUTE);
    expect(back).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/student-card/timetable');
  });

  it('replaces the entry with the parent screen after a direct link or reload', async () => {
    await goTo('#/schedule/timetable');
    await goTo('#/student-card/timetable');
    const back = vi.spyOn(window.history, 'back');
    goBack(STUDENT_CARD_ROUTE);
    expect(back).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#/student-card');
  });
});
