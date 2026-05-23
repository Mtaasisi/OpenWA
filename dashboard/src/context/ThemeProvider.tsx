import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppearanceMode, CustomThemeInput, DashboardTheme } from '../lib/theme-types';
import {
  ACTIVE_THEME_ID_KEY,
  APPEARANCE_KEY,
  DEFAULT_THEME_ID,
  applyAppearanceMode,
  applyThemePalette,
  createCustomTheme,
  duplicateTheme,
  getAllThemes,
  getThemeById,
  loadCustomThemes,
  resolveAppearance,
  saveCustomThemes,
} from '../lib/themes';

interface ThemeContextValue {
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
  toggleAppearance: () => void;
  resolvedAppearance: 'light' | 'dark';
  activeThemeId: string;
  setActiveThemeId: (id: string) => void;
  themes: DashboardTheme[];
  activeTheme: DashboardTheme;
  addCustomTheme: (input: CustomThemeInput) => DashboardTheme;
  updateCustomTheme: (id: string, input: CustomThemeInput) => void;
  deleteCustomTheme: (id: string) => void;
  duplicateCustomTheme: (id: string) => DashboardTheme | null;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>(() => {
    const saved = localStorage.getItem(APPEARANCE_KEY) as AppearanceMode | null;
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  const [activeThemeId, setActiveThemeIdState] = useState(() => {
    return localStorage.getItem(ACTIVE_THEME_ID_KEY) || DEFAULT_THEME_ID;
  });

  const [customThemes, setCustomThemes] = useState<DashboardTheme[]>(() => loadCustomThemes());

  const themes = useMemo(() => getAllThemes(customThemes), [customThemes]);

  const activeTheme = useMemo(
    () => getThemeById(activeThemeId, customThemes) ?? themes[0],
    [activeThemeId, customThemes, themes],
  );

  const resolvedAppearance = useMemo(
    () => (typeof window !== 'undefined' ? resolveAppearance(appearance) : 'light'),
    [appearance],
  );

  useEffect(() => {
    applyAppearanceMode(appearance);
    localStorage.setItem(APPEARANCE_KEY, appearance);
  }, [appearance]);

  useEffect(() => {
    applyThemePalette(activeTheme, resolvedAppearance);
    localStorage.setItem(ACTIVE_THEME_ID_KEY, activeThemeId);
  }, [activeTheme, activeThemeId, resolvedAppearance]);

  useEffect(() => {
    if (appearance !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemePalette(activeTheme, resolveAppearance('system'));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [appearance, activeTheme]);

  const setAppearance = useCallback((mode: AppearanceMode) => {
    setAppearanceState(mode);
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearanceState(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, []);

  const setActiveThemeId = useCallback(
    (id: string) => {
      setActiveThemeIdState(id);
      const next = getThemeById(id, customThemes);
      if (next?.effects === 'tactical' && appearance === 'light') {
        setAppearanceState('dark');
      }
    },
    [customThemes, appearance],
  );

  const persistCustom = useCallback((next: DashboardTheme[]) => {
    setCustomThemes(next);
    saveCustomThemes(next);
  }, []);

  const addCustomTheme = useCallback(
    (input: CustomThemeInput) => {
      const theme = createCustomTheme(input);
      persistCustom([...customThemes, theme]);
      return theme;
    },
    [customThemes, persistCustom],
  );

  const updateCustomTheme = useCallback(
    (id: string, input: CustomThemeInput) => {
      persistCustom(
        customThemes.map(t =>
          t.id === id
            ? {
                ...t,
                name: input.name.trim(),
                description: input.description?.trim() || undefined,
                light: { ...input.light },
                dark: { ...input.dark },
              }
            : t,
        ),
      );
    },
    [customThemes, persistCustom],
  );

  const deleteCustomTheme = useCallback(
    (id: string) => {
      persistCustom(customThemes.filter(t => t.id !== id));
      setActiveThemeIdState(prev => (prev === id ? DEFAULT_THEME_ID : prev));
    },
    [customThemes, persistCustom],
  );

  const duplicateCustomTheme = useCallback(
    (id: string) => {
      const source = customThemes.find(t => t.id === id) ?? themes.find(t => t.id === id);
      if (!source) return null;
      const copy = duplicateTheme(source);
      persistCustom([...customThemes, copy]);
      return copy;
    },
    [customThemes, persistCustom, themes],
  );

  const value = useMemo(
    () => ({
      appearance,
      setAppearance,
      toggleAppearance,
      resolvedAppearance,
      activeThemeId,
      setActiveThemeId,
      themes,
      activeTheme,
      addCustomTheme,
      updateCustomTheme,
      deleteCustomTheme,
      duplicateCustomTheme,
    }),
    [
      appearance,
      setAppearance,
      toggleAppearance,
      resolvedAppearance,
      activeThemeId,
      setActiveThemeId,
      themes,
      activeTheme,
      addCustomTheme,
      updateCustomTheme,
      deleteCustomTheme,
      duplicateCustomTheme,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return ctx;
}
