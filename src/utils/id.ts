/** Returns a short random identifier that satisfies IdSchema (letters, digits, "-", "_"). */
export function createId(prefix = 'id'): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `${prefix}_${random}`;
}
