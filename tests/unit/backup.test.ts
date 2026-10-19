import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENTS, DEFAULT_NOTICES, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../src/data/defaults';
import { DEFAULT_PRESETS } from '../../src/data/defaultPresets';
import { createExampleTimetable } from '../../src/data/exampleTimetable';
import { createBackup, parseBackup, serializeBackup } from '../../src/services/backup/backupService';

const data = {
  timetable: createExampleTimetable(),
  presets: [...DEFAULT_PRESETS],
  profile: DEFAULT_PROFILE,
  notices: [...DEFAULT_NOTICES],
  events: [...DEFAULT_EVENTS],
  settings: DEFAULT_SETTINGS,
};

describe('backup export/import', () => {
  it('round-trips a full backup', () => {
    const text = serializeBackup(createBackup(data, 'all', '1.0.0', new Date('2026-10-19T08:00:00Z')));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.parts).toEqual(['timetable', 'presets', 'profile', 'notices', 'events', 'settings']);
      expect(parsed.backup.data.timetable).toEqual(data.timetable);
    }
  });

  it('exports presets independently of the timetable', () => {
    const parsed = parseBackup(serializeBackup(createBackup(data, 'presets', '1.0.0')));
    expect(parsed.ok && parsed.parts).toEqual(['presets']);
  });

  it('rejects non-JSON, foreign JSON and empty backups', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, error: 'הקובץ אינו JSON תקין' });
    expect(parseBackup('{"a":1}')).toEqual({ ok: false, error: 'הקובץ אינו קובץ גיבוי של האפליקציה' });
    const empty = { format: 'webtop-pwa-backup', formatVersion: 1, exportedAt: '', appVersion: '1', data: {} };
    expect(parseBackup(JSON.stringify(empty)).ok).toBe(false);
  });

  it('rejects a timetable whose day has the wrong number of periods', () => {
    const backup = createBackup(data, 'timetable', '1.0.0');
    const broken = structuredClone(backup);
    broken.data.timetable?.days.sun.pop();
    const result = parseBackup(JSON.stringify(broken));
    expect(result.ok).toBe(false);
  });

  it('rejects invalid colours and oversized text', () => {
    const backup = createBackup(data, 'presets', '1.0.0');
    const badColour = structuredClone(backup);
    if (badColour.data.presets?.[0]) badColour.data.presets[0].color = 'red';
    expect(parseBackup(JSON.stringify(badColour)).ok).toBe(false);
    const longText = structuredClone(backup);
    if (longText.data.presets?.[0]) longText.data.presets[0].subject = 'א'.repeat(500);
    expect(parseBackup(JSON.stringify(longText)).ok).toBe(false);
  });
});
