/** Default values for the non-timetable slices (profile, notices, events, settings). */
import type { Notice, Profile, SchoolEvent, Settings } from '../schemas/content';

export const DEFAULT_PROFILE: Profile = {
  studentName: '',
  subtitle: 'עותק אישי · לא רשמי',
  className: "י' 1 (דוגמה)",
};

export const DEFAULT_NOTICES: readonly Notice[] = [];
export const DEFAULT_EVENTS: readonly SchoolEvent[] = [];

export const DEFAULT_SETTINGS: Settings = {
  changeAlerts: false,
  shortcuts: ['timetable', 'events'],
  eventsView: 'list',
  eventsKindFilter: 'all',
};
