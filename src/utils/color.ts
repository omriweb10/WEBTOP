/** Small colour helpers (hex only) used to derive lesson-card tints. */

/** Parses "#rrggbb" into [r, g, b]; returns null for anything else. */
export function parseHex(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Formats [r, g, b] as "#rrggbb". */
export function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Mixes `color` into `base` at `ratio` (0–1), like CSS color-mix(in srgb …).
 * Done in JS so older iOS versions without color-mix render identical card tints.
 */
export function mixHex(color: string, base: string, ratio: number): string {
  const a = parseHex(color);
  const b = parseHex(base);
  if (!a || !b) return base;
  // Linear interpolation of one channel.
  const mix = (from: number, to: number) => from + (to - from) * ratio;
  return toHex([mix(b[0], a[0]), mix(b[1], a[1]), mix(b[2], a[2])]);
}
