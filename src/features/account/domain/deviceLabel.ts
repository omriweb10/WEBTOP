/** Short, non-identifying description of this device for the admin's sessions list. */
export function describeDevice(userAgent: string, standalone: boolean): string {
  const device = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile/.test(userAgent))
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Macintosh/.test(userAgent)
          ? 'Mac'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : 'מכשיר';
  const browser = /CriOS|Chrome\//.test(userAgent) && !/Edg\//.test(userAgent)
    ? 'Chrome'
    : /Edg\//.test(userAgent)
      ? 'Edge'
      : /FxiOS|Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'דפדפן';
  return `${device} · ${standalone ? 'אפליקציה ממסך הבית' : browser}`;
}
