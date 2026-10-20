/** Turns pasted text into blocks of lines: one block per subject, separated by empty lines. */
import type { TextBlock } from './types';

// Invisible characters that Hebrew text often carries when copied from documents or chats:
// direction marks and embeddings, the byte-order mark and zero-width spaces.
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
// Non-breaking and other unusual spaces, plus tabs.
const ODD_SPACES = /[\t\u00a0\u2007\u202f]/g;

/** Unifies line endings (Windows, old Mac, Unix) and spaces, and drops invisible marks. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(INVISIBLE, '').replace(ODD_SPACES, ' ');
}

/** Splits the text at blank lines (any number, spaces allowed), keeping 1-based line numbers. */
export function splitBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let current: TextBlock | null = null;
  normalizeText(text)
    .split('\n')
    .forEach((raw, index) => {
      if (raw.trim() === '') {
        current = null;
        return;
      }
      if (!current) {
        current = { number: blocks.length + 1, lines: [] };
        blocks.push(current);
      }
      current.lines.push({ lineNumber: index + 1, text: raw });
    });
  return blocks;
}
