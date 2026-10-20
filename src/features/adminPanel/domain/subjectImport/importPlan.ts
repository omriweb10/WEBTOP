/**
 * Duplicate detection: compares the pasted subjects with the student's existing subjects
 * (by name, ignoring spacing and case) and decides, per subject, what the import does.
 */
import type { PresetRow } from '../../api/types';
import { nameKey } from '../presetCopy';
import type { ImportedSubject } from './types';

/**
 * create    — no subject with this name yet.
 * identical — an active subject with the same name, teacher, room and colour: always skipped.
 * conflict  — same name but different details, or hidden: skipped unless the admin chooses
 *             to update the existing subject.
 */
export type PlanKind = 'create' | 'identical' | 'conflict';

export interface Change {
  label: string;
  from: string;
  to: string;
}

export interface PlanItem {
  subject: ImportedSubject;
  kind: PlanKind;
  existing: PresetRow | null;
  /** What an update would change (conflicts only). */
  changes: Change[];
}

export interface PlanCounts {
  create: number;
  skip: number;
  update: number;
}

/** Same teacher, room and colour (trimmed; colour case-insensitive). */
function sameDetails(subject: ImportedSubject, preset: PresetRow): boolean {
  const a = subject.fields;
  return a.teacher.trim() === preset.teacher.trim() && a.room.trim() === preset.room.trim() && a.color.toLowerCase() === preset.color.toLowerCase();
}

/** What updating `preset` with `subject` would change, in words. */
function describeChanges(subject: ImportedSubject, preset: PresetRow): Change[] {
  const a = subject.fields;
  const changes: Change[] = [];
  const shown = (value: string) => value.trim() || '—';
  if (a.teacher.trim() !== preset.teacher.trim()) changes.push({ label: 'מורה', from: shown(preset.teacher), to: shown(a.teacher) });
  if (a.room.trim() !== preset.room.trim()) changes.push({ label: 'חדר', from: shown(preset.room), to: shown(a.room) });
  if (a.color.toLowerCase() !== preset.color.toLowerCase()) changes.push({ label: 'צבע', from: preset.color.toLowerCase(), to: a.color });
  if (preset.archived_at) changes.push({ label: 'מצב', from: 'מוסתר', to: 'זמין לבחירה' });
  return changes;
}

/** Plans the import of `subjects` into a student whose current subjects are `existing`. */
export function planImport(subjects: readonly ImportedSubject[], existing: readonly PresetRow[]): PlanItem[] {
  return subjects.map((subject) => {
    const matches = existing.filter((preset) => nameKey(preset.name) === nameKey(subject.fields.name));
    if (matches.length === 0) return { subject, kind: 'create', existing: null, changes: [] };
    const twin = matches.find((preset) => !preset.archived_at && sameDetails(subject, preset));
    if (twin) return { subject, kind: 'identical', existing: twin, changes: [] };
    const target = matches.find((preset) => !preset.archived_at) ?? matches[0] ?? null;
    return { subject, kind: 'conflict', existing: target, changes: target ? describeChanges(subject, target) : [] };
  });
}

/** How many subjects the import creates, skips and updates for the admin's choice. */
export function countPlan(items: readonly PlanItem[], updateConflicts: boolean): PlanCounts {
  const conflicts = items.filter((item) => item.kind === 'conflict').length;
  return {
    create: items.filter((item) => item.kind === 'create').length,
    skip: items.filter((item) => item.kind === 'identical').length + (updateConflicts ? 0 : conflicts),
    update: updateConflicts ? conflicts : 0,
  };
}
