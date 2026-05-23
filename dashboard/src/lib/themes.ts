import type { AppearanceMode, CustomThemeInput, DashboardTheme, ThemePalette } from './theme-types';

export const APPEARANCE_KEY = 'openwa_theme';
export const ACTIVE_THEME_ID_KEY = 'openwa_active_theme_id';
export const CUSTOM_THEMES_KEY = 'openwa_custom_themes';

export const DEFAULT_THEME_ID = 'default';
export const TACTICAL_OVERLAY_THEME_ID = 'tactical-overlay';

const whatsappLight: ThemePalette = {
  primary: '#25d366',
  primaryHover: '#1da851',
  bgLight: '#f8fafc',
  bgWhite: '#ffffff',
  bgCard: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

const whatsappDark: ThemePalette = {
  primary: '#25d366',
  primaryHover: '#1da851',
  bgLight: '#0f172a',
  bgWhite: '#1e293b',
  bgCard: '#1e293b',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
  border: '#334155',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

export const BUILTIN_THEMES: DashboardTheme[] = [
  {
    id: DEFAULT_THEME_ID,
    name: 'OpenWA',
    description: 'Default WhatsApp green palette',
    builtin: true,
    light: whatsappLight,
    dark: whatsappDark,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool blues for a calm workspace',
    builtin: true,
    light: {
      primary: '#0ea5e9',
      primaryHover: '#0284c7',
      bgLight: '#f0f9ff',
      bgWhite: '#ffffff',
      bgCard: '#ffffff',
      textPrimary: '#0c4a6e',
      textSecondary: '#0369a1',
      textMuted: '#7dd3fc',
      border: '#bae6fd',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
    dark: {
      primary: '#38bdf8',
      primaryHover: '#0ea5e9',
      bgLight: '#0c1929',
      bgWhite: '#172554',
      bgCard: '#1e3a5f',
      textPrimary: '#e0f2fe',
      textSecondary: '#7dd3fc',
      textMuted: '#64748b',
      border: '#1e40af',
      error: '#f87171',
      success: '#4ade80',
      warning: '#fbbf24',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm coral and amber tones',
    builtin: true,
    light: {
      primary: '#f97316',
      primaryHover: '#ea580c',
      bgLight: '#fff7ed',
      bgWhite: '#ffffff',
      bgCard: '#ffffff',
      textPrimary: '#431407',
      textSecondary: '#9a3412',
      textMuted: '#fdba74',
      border: '#fed7aa',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#eab308',
    },
    dark: {
      primary: '#fb923c',
      primaryHover: '#f97316',
      bgLight: '#1c1210',
      bgWhite: '#292018',
      bgCard: '#3d2c1e',
      textPrimary: '#ffedd5',
      textSecondary: '#fdba74',
      textMuted: '#78716c',
      border: '#78350f',
      error: '#f87171',
      success: '#4ade80',
      warning: '#fbbf24',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep violet accents',
    builtin: true,
    light: {
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      bgLight: '#f5f3ff',
      bgWhite: '#ffffff',
      bgCard: '#ffffff',
      textPrimary: '#1e1b4b',
      textSecondary: '#5b21b6',
      textMuted: '#a78bfa',
      border: '#ddd6fe',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
    dark: {
      primary: '#a78bfa',
      primaryHover: '#8b5cf6',
      bgLight: '#0f0a1a',
      bgWhite: '#1a1225',
      bgCard: '#251a35',
      textPrimary: '#ede9fe',
      textSecondary: '#c4b5fd',
      textMuted: '#6b7280',
      border: '#4c1d95',
      error: '#f87171',
      success: '#4ade80',
      warning: '#fbbf24',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Earthy greens',
    builtin: true,
    light: {
      primary: '#16a34a',
      primaryHover: '#15803d',
      bgLight: '#f0fdf4',
      bgWhite: '#ffffff',
      bgCard: '#ffffff',
      textPrimary: '#14532d',
      textSecondary: '#166534',
      textMuted: '#86efac',
      border: '#bbf7d0',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
    dark: {
      primary: '#4ade80',
      primaryHover: '#22c55e',
      bgLight: '#0a1410',
      bgWhite: '#14241a',
      bgCard: '#1a3024',
      textPrimary: '#dcfce7',
      textSecondary: '#86efac',
      textMuted: '#6b7280',
      border: '#166534',
      error: '#f87171',
      success: '#4ade80',
      warning: '#fbbf24',
    },
  },
  {
    id: TACTICAL_OVERLAY_THEME_ID,
    name: 'Tactical Overlay',
    description: 'OmniCRM HUD — cyan telemetry on deep black (v4.2)',
    builtin: true,
    effects: 'tactical',
    light: {
      primary: '#0891b2',
      primaryHover: '#0e7490',
      bgLight: '#e2e8f0',
      bgWhite: '#f8fafc',
      bgCard: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#334155',
      textMuted: '#64748b',
      border: '#94a3b8',
      error: '#ef4444',
      success: '#16a34a',
      warning: '#d97706',
    },
    dark: {
      primary: '#22d3ee',
      primaryHover: '#0891b2',
      bgLight: '#02060c',
      bgWhite: '#050b14',
      bgCard: '#03070d',
      textPrimary: '#cbd5e1',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#1e293b',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
  },
];

const CSS_VAR_MAP: Record<keyof ThemePalette, string> = {
  primary: '--primary',
  primaryHover: '--primary-hover',
  bgLight: '--bg-light',
  bgWhite: '--bg-white',
  bgCard: '--bg-card',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  border: '--border',
  error: '--error',
  success: '--success',
  warning: '--warning',
};

function scrollThumbFor(isDark: boolean): string {
  return isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(15, 23, 42, 0.2)';
}

function accentLightFor(primary: string): string {
  const hex = primary.replace('#', '');
  if (hex.length !== 6) return 'rgba(37, 211, 102, 0.18)';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.18)`;
}

export function resolveAppearance(mode: AppearanceMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function loadCustomThemes(): DashboardTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DashboardTheme[];
    return Array.isArray(parsed) ? parsed.filter(t => t.id && t.name && t.light && t.dark) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: DashboardTheme[]): void {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

export function getAllThemes(customThemes: DashboardTheme[]): DashboardTheme[] {
  return [...BUILTIN_THEMES, ...customThemes];
}

export function getThemeById(id: string, customThemes: DashboardTheme[]): DashboardTheme | undefined {
  return getAllThemes(customThemes).find(t => t.id === id);
}

export function applyAppearanceMode(mode: AppearanceMode): void {
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
}

export function clearCustomThemeVariables(): void {
  const root = document.documentElement;
  const keys = [
    ...Object.values(CSS_VAR_MAP),
    '--bg-main',
    '--accent',
    '--accent-light',
    '--scroll-thumb',
    '--scroll-thumb-hover',
  ];
  for (const key of keys) {
    root.style.removeProperty(key);
  }
  root.removeAttribute('data-theme-id');
  root.removeAttribute('data-theme-effects');
  root.style.removeProperty('--radius');
}

export function applyThemePalette(theme: DashboardTheme, resolved: 'light' | 'dark'): void {
  const root = document.documentElement;

  if (theme.id === DEFAULT_THEME_ID) {
    clearCustomThemeVariables();
    return;
  }

  const palette = resolved === 'dark' ? theme.dark : theme.light;
  const isDark = resolved === 'dark';

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP) as [keyof ThemePalette, string][]) {
    root.style.setProperty(cssVar, palette[key]);
  }

  root.style.setProperty('--bg-main', palette.bgLight);
  root.style.setProperty('--accent', palette.primary);
  root.style.setProperty('--accent-light', accentLightFor(palette.primary));
  root.style.setProperty('--scroll-thumb', scrollThumbFor(isDark));
  root.style.setProperty(
    '--scroll-thumb-hover',
    isDark ? 'rgba(148, 163, 184, 0.42)' : 'rgba(15, 23, 42, 0.32)',
  );
  root.setAttribute('data-theme-id', theme.id);
  if (theme.effects === 'tactical') {
    root.setAttribute('data-theme-effects', 'tactical');
  } else {
    root.removeAttribute('data-theme-effects');
  }

  if (theme.id === TACTICAL_OVERLAY_THEME_ID) {
    root.style.setProperty('--scroll-thumb', 'rgba(34, 211, 238, 0.2)');
    root.style.setProperty('--scroll-thumb-hover', 'rgba(34, 211, 238, 0.45)');
    root.style.setProperty('--radius', '0');
    root.style.setProperty('--shadow-sm', 'none');
    root.style.setProperty('--shadow-md', 'inset 0 0 12px rgba(34, 211, 238, 0.04)');
    root.style.setProperty('--shadow-lg', '0 0 24px rgba(34, 211, 238, 0.08)');
  }
}

export function createCustomTheme(input: CustomThemeInput): DashboardTheme {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    builtin: false,
    light: { ...input.light },
    dark: { ...input.dark },
  };
}

export function duplicateTheme(theme: DashboardTheme): DashboardTheme {
  return {
    ...theme,
    id: `custom-${crypto.randomUUID()}`,
    name: `${theme.name} (copy)`,
    builtin: false,
    effects: theme.effects,
  };
}

export const PALETTE_FIELDS: { key: keyof ThemePalette; labelKey: string }[] = [
  { key: 'primary', labelKey: 'primary' },
  { key: 'primaryHover', labelKey: 'primaryHover' },
  { key: 'bgLight', labelKey: 'bgLight' },
  { key: 'bgWhite', labelKey: 'bgWhite' },
  { key: 'bgCard', labelKey: 'bgCard' },
  { key: 'textPrimary', labelKey: 'textPrimary' },
  { key: 'textSecondary', labelKey: 'textSecondary' },
  { key: 'textMuted', labelKey: 'textMuted' },
  { key: 'border', labelKey: 'border' },
  { key: 'error', labelKey: 'error' },
  { key: 'success', labelKey: 'success' },
  { key: 'warning', labelKey: 'warning' },
];

export function defaultCustomPalette(): ThemePalette {
  return { ...whatsappLight };
}
