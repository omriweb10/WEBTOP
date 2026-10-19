/** Initials for an avatar placeholder (first letters of up to two words). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]).join('') || '?';
}
