/** Joins truthy class names; keeps JSX free of string-concatenation noise. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
