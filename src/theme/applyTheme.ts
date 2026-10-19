/** Applies a resolved theme to the document: the data attribute the CSS keys on, plus chrome metas. */
import { THEME_ATTRIBUTE, THEME_CHROME, type ResolvedTheme } from './themeConfig';

/** Sets a <meta name=…> content, creating the tag if the page has none. */
function setMeta(doc: Document, name: string, content: string): void {
  let meta = doc.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = doc.createElement('meta');
    meta.name = name;
    doc.head.appendChild(meta);
  }
  if (meta.content !== content) meta.content = content;
}

/** Switches the whole UI to `theme` (CSS tokens follow the attribute; no reload needed). */
export function applyTheme(theme: ResolvedTheme, doc: Document = document): void {
  const chrome = THEME_CHROME[theme];
  doc.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  setMeta(doc, 'theme-color', chrome.themeColor);
  setMeta(doc, 'color-scheme', chrome.colorScheme);
  setMeta(doc, 'apple-mobile-web-app-status-bar-style', chrome.statusBarStyle);
}
