/** Shared types of the "import subjects from text" feature. */
import type { PresetFields } from '../../api/types';

/** The four fields of one subject in the pasted text. */
export type ImportField = 'name' | 'teacher' | 'room' | 'color';

/** How each field is written in the text (and named in messages). */
export const FIELD_LABELS: Readonly<Record<ImportField, string>> = {
  name: 'מקצוע',
  teacher: 'שם מורה',
  room: 'חדר',
  color: 'צבע',
};

export const IMPORT_FIELDS: readonly ImportField[] = ['name', 'teacher', 'room', 'color'];

/** One line of the text with its 1-based line number. */
export interface TextLine {
  lineNumber: number;
  text: string;
}

/** A group of lines separated from the next by an empty line: one subject. */
export interface TextBlock {
  /** 1-based position of the subject in the text. */
  number: number;
  lines: TextLine[];
}

/** A problem that blocks the import, pointing at the subject (and field / line). */
export interface ImportIssue {
  subject: number;
  subjectName: string | null;
  field: ImportField | null;
  line: number | null;
  message: string;
}

/** A fully valid subject from the text, ready to become a preset. */
export interface ImportedSubject {
  number: number;
  fields: PresetFields;
}

export interface ParseResult {
  /** Number of subject blocks found (valid or not). */
  blockCount: number;
  subjects: ImportedSubject[];
  issues: ImportIssue[];
}
