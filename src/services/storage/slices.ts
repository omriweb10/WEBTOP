/**
 * Registry of every persisted slice: storage key, schema version, validation schema and
 * defaults. Bump a slice's `version` and add a migration when its schema changes.
 */
import { DEFAULT_EVENTS, DEFAULT_NOTICES, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../data/defaults';
import { DEFAULT_PRESETS } from '../../data/defaultPresets';
import { createExampleTimetable } from '../../data/exampleTimetable';
import {
  NoticeListSchema,
  ProfileSchema,
  SchoolEventListSchema,
  SettingsSchema,
  type Notice,
  type Profile,
  type SchoolEvent,
  type Settings,
} from '../../schemas/content';
import { PresetListSchema, type Preset } from '../../schemas/presets';
import { TimetableSchema, type Timetable } from '../../schemas/timetable';
import type { PersistedValueSpec } from './persistedValue';

const NAMESPACE = 'webtop-pwa';

export const timetableSlice: PersistedValueSpec<Timetable> = {
  key: `${NAMESPACE}:timetable`,
  version: 1,
  schema: TimetableSchema,
  defaults: createExampleTimetable,
};

export const presetsSlice: PersistedValueSpec<Preset[]> = {
  key: `${NAMESPACE}:presets`,
  version: 1,
  schema: PresetListSchema,
  defaults: () => DEFAULT_PRESETS.map((p) => ({ ...p })),
};

/** The sidebar subtitle that version 1 shipped as its default. */
export const LEGACY_DEFAULT_SUBTITLE = 'עותק אישי · לא רשמי';

export const profileSlice: PersistedValueSpec<Profile> = {
  key: `${NAMESPACE}:profile`,
  version: 2,
  schema: ProfileSchema,
  defaults: () => ({ ...DEFAULT_PROFILE }),
  migrations: {
    // v1 → v2: an untouched old default subtitle becomes the new default; text the user
    // wrote is kept as it is.
    1: (data) =>
      typeof data === 'object' && data !== null && (data as { subtitle?: unknown }).subtitle === LEGACY_DEFAULT_SUBTITLE
        ? { ...data, subtitle: DEFAULT_PROFILE.subtitle }
        : data,
  },
};

export const noticesSlice: PersistedValueSpec<Notice[]> = {
  key: `${NAMESPACE}:notices`,
  version: 1,
  schema: NoticeListSchema,
  defaults: () => [...DEFAULT_NOTICES],
};

export const eventsSlice: PersistedValueSpec<SchoolEvent[]> = {
  key: `${NAMESPACE}:events`,
  version: 1,
  schema: SchoolEventListSchema,
  defaults: () => [...DEFAULT_EVENTS],
};

export const settingsSlice: PersistedValueSpec<Settings> = {
  key: `${NAMESPACE}:settings`,
  version: 1,
  schema: SettingsSchema,
  defaults: () => ({ ...DEFAULT_SETTINGS, shortcuts: [...DEFAULT_SETTINGS.shortcuts] }),
};

/** sessionStorage key marking the local edit mode as unlocked for this app session. */
export const EDIT_SESSION_KEY = `${NAMESPACE}:edit-session`;
/** localStorage key holding the ISO timestamp of the previous app launch. */
export const LAST_OPENED_KEY = `${NAMESPACE}:last-opened`;
