/** Time-of-day greeting for the home screen ("בוקר טוב, ..."). */

/** Picks a Hebrew greeting for the given hour (0–23). */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 17) return 'צהריים טובים';
  if (hour >= 17 && hour < 21) return 'ערב טוב';
  return 'לילה טוב';
}

/** Full greeting line; omits the comma when no name is configured. */
export function greetingLine(hour: number, name: string): string {
  const greeting = greetingForHour(hour);
  return name.trim() ? `${greeting}, ${name.trim()}` : greeting;
}
