import { useEffect } from 'react';
import { applyTheme } from './applyTheme';
import { useResolvedTheme } from './useResolvedTheme';

/** Keeps the document in the resolved theme (preference changes and, in System, device changes). */
export function useThemeSync(): void {
  const theme = useResolvedTheme();
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
