import { useThemeContext } from '../context/ThemeProvider';
import type { AppearanceMode } from '../lib/theme-types';

/** @deprecated Use appearance from useThemeContext; kept for Layout sidebar toggle */
export type Theme = AppearanceMode;

export function useTheme() {
  const {
    appearance: theme,
    setAppearance: setTheme,
    toggleAppearance: toggleTheme,
    resolvedAppearance: resolvedTheme,
    activeTheme,
    activeThemeId,
  } = useThemeContext();

  return { theme, setTheme, toggleTheme, resolvedTheme, activeTheme, activeThemeId };
}
