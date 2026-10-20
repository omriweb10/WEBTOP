/**
 * Parses and validates the pasted subjects. Every block must hold the four fields
 * ("מקצוע", "שם מורה", "חדר", "צבע") once each; the subject name and a supported colour are
 * required, teacher and room may be written empty. Anything else is reported per subject,
 * field and line, and only blocks without issues become subjects.
 */
import type { PresetFields } from '../../api/types';
import { nameKey } from '../presetCopy';
import { PRESET_LIMITS } from '../presetForm';
import { COLOR_NAME_LIST, normalizeColor } from './colorNames';
import { splitBlocks } from './textBlocks';
import { FIELD_LABELS, IMPORT_FIELDS, type ImportField, type ImportIssue, type ImportedSubject, type ParseResult, type TextBlock } from './types';

// "field : value" — any spacing around the colon (also the full-width colon).
const FIELD_LINE = /^\s*([^:：]+?)\s*[:：]\s*(.*?)\s*$/;

// Accepted spellings of each field name (after normalising spaces, hyphens and maqaf).
const FIELD_NAMES: ReadonlyMap<string, ImportField> = new Map([
  ['מקצוע', 'name'],
  ['שם מקצוע', 'name'],
  ['שם המקצוע', 'name'],
  ['שם מורה', 'teacher'],
  ['שם המורה', 'teacher'],
  ['מורה', 'teacher'],
  ['חדר', 'room'],
  ['מספר חדר', 'room'],
  ['צבע', 'color'],
]);

/** "שם-מורה", "שם  מורה" and "שם ־ מורה" all become "שם מורה". */
function fieldNameKey(raw: string): string {
  return raw.replace(/[-_־]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Collapses runs of spaces inside a value. */
function cleanValue(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Reads one block's lines into fields, collecting syntax issues. */
function readFields(block: TextBlock, issue: (message: string, field?: ImportField, line?: number) => void) {
  const values: Partial<Record<ImportField, { value: string; line: number }>> = {};
  for (const { lineNumber, text } of block.lines) {
    const match = FIELD_LINE.exec(text);
    if (!match) {
      issue(`שורה ${lineNumber} אינה בפורמט „שדה : ערך”.`, undefined, lineNumber);
      continue;
    }
    const field = FIELD_NAMES.get(fieldNameKey(match[1] ?? ''));
    if (!field) {
      issue(`שדה לא מוכר „${(match[1] ?? '').trim()}” בשורה ${lineNumber}. השדות הם: מקצוע, שם מורה, חדר, צבע.`, undefined, lineNumber);
      continue;
    }
    if (values[field]) {
      issue(`השדה „${FIELD_LABELS[field]}” מופיע פעמיים (שורה ${lineNumber}).`, field, lineNumber);
      continue;
    }
    values[field] = { value: cleanValue(match[2] ?? ''), line: lineNumber };
  }
  return values;
}

/** Validates one block; returns its subject, or null after reporting why not. */
function parseBlock(block: TextBlock, issues: ImportIssue[]): ImportedSubject | null {
  const before = issues.length;
  let subjectName: string | null = null;
  const issue = (message: string, field?: ImportField, line?: number) =>
    issues.push({ subject: block.number, subjectName, field: field ?? null, line: line ?? null, message });

  const values = readFields(block, issue);
  subjectName = values.name?.value || null;
  for (const entry of issues.slice(before)) entry.subjectName = subjectName;

  for (const field of IMPORT_FIELDS) {
    if (!values[field]) issue(`חסר השדה „${FIELD_LABELS[field]}”.`, field, block.lines[0]?.lineNumber);
  }
  const name = values.name;
  if (name && !name.value) issue('שם המקצוע ריק.', 'name', name.line);
  for (const field of ['name', 'teacher', 'room'] as const) {
    const entry = values[field];
    if (entry && entry.value.length > PRESET_LIMITS[field]) {
      issue(`„${FIELD_LABELS[field]}” ארוך מדי (עד ${PRESET_LIMITS[field]} תווים).`, field, entry.line);
    }
  }
  const color = values.color;
  const hex = color ? normalizeColor(color.value) : null;
  if (color && !hex) {
    const shown = color.value || 'ריק';
    issue(`הצבע „${shown}” אינו מוכר. כתבו \u200e#RRGGBB או אחד מהשמות: ${COLOR_NAME_LIST.join(', ')}.`, 'color', color.line);
  }

  if (issues.length > before || !name || !hex) return null;
  const fields: PresetFields = {
    name: name.value,
    short_name: '',
    teacher: values.teacher?.value ?? '',
    room: values.room?.value ?? '',
    color: hex,
    notes: '',
  };
  return { number: block.number, fields };
}

/** Parses the whole text: valid subjects, every issue, and how many blocks were found. */
export function parseSubjectText(text: string): ParseResult {
  const blocks = splitBlocks(text);
  const issues: ImportIssue[] = [];
  const subjects: ImportedSubject[] = [];
  const firstByName = new Map<string, number>();

  for (const block of blocks) {
    const subject = parseBlock(block, issues);
    if (!subject) continue;
    // The same subject twice in one paste is ambiguous: report it instead of guessing.
    const key = nameKey(subject.fields.name);
    const first = firstByName.get(key);
    if (first !== undefined) {
      issues.push({
        subject: block.number,
        subjectName: subject.fields.name,
        field: 'name',
        line: block.lines[0]?.lineNumber ?? null,
        message: `המקצוע מופיע בטקסט יותר מפעם אחת (גם כמקצוע ${first}).`,
      });
      continue;
    }
    firstByName.set(key, block.number);
    subjects.push(subject);
  }
  return { blockCount: blocks.length, subjects, issues };
}
