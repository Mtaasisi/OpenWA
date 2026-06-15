import type { AppearanceMode, CustomThemeInput, DashboardTheme, ThemePalette } from './theme-types';
import { randomId } from './random-id';

export const APPEARANCE_KEY = 'openwa_theme';
export const ACTIVE_THEME_ID_KEY = 'openwa_active_theme_id';
export const CUSTOM_THEMES_KEY = 'openwa_custom_themes';

export const DEFAULT_THEME_ID = 'default';
export const TACTICAL_OVERLAY_THEME_ID = 'tactical-overlay';
export const INTERAKT_INBOX_THEME_ID = 'interakt-inbox';
export const DIGITAL_RECONSTRUCTION_THEME_ID = 'digital-reconstruction';

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

export const BUILTIN_THEMES: DashboardTheme[] = [
  {
    id: DEFAULT_THEME_ID,
    name: 'WhatsApp Classic',
    description: 'Default green WhatsApp-style dashboard',
    builtin: true,
    light: whatsappLight,
    dark: {
      primary: '#25d366',
      primaryHover: '#1da851',
      bgLight: '#0b141a',
      bgWhite: '#111b21',
      bgCard: '#1f2c34',
      textPrimary: '#e9edef',
      textSecondary: '#8696a0',
      textMuted: '#667781',
      border: '#2a3942',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
  },
  {
    id: INTERAKT_INBOX_THEME_ID,
    name: 'Interakt Inbox',
    description: 'Interakt CRM — Shared Inbox layout & colors',
    builtin: true,
    effects: 'interakt',
    light: {
      primary: '#006d2f',
      primaryHover: '#005322',
      bgLight: '#faf9fe',
      bgWhite: '#ffffff',
      bgCard: '#ffffff',
      textPrimary: '#1a1b1f',
      textSecondary: '#636366',
      textMuted: '#9ca3af',
      border: '#D1D1D6',
      error: '#ba1a1a',
      success: '#25d366',
      warning: '#d97706',
    },
    dark: {
      primary: '#3d9b72',
      primaryHover: '#2f8a63',
      bgLight: '#0f1612',
      bgWhite: '#162019',
      bgCard: '#1c2a22',
      textPrimary: '#e8f0eb',
      textSecondary: '#a8bdb0',
      textMuted: '#6b8578',
      border: '#2a3d32',
      error: '#f87171',
      success: '#4ade80',
      warning: '#fbbf24',
    },
  },
  {
    id: DIGITAL_RECONSTRUCTION_THEME_ID,
    name: 'Digital Reconstruction',
    description: 'Stitch Patient Support — blue accent, 80px icon sidebar, Inter typography',
    builtin: true,
    effects: 'stitch',
    light: {
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      bgLight: '#F8F9FB',
      bgWhite: '#ffffff',
      bgCard: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#9ca3af',
      border: '#f3f4f6',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
    dark: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      bgLight: '#0f1419',
      bgWhite: '#111827',
      bgCard: '#1f2937',
      textPrimary: '#f9fafb',
      textSecondary: '#d1d5db',
      textMuted: '#9ca3af',
      border: '#374151',
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
  root.removeAttribute('data-theme-resolved');
  root.style.removeProperty('--radius');
}

export function applyThemePalette(theme: DashboardTheme, resolved: 'light' | 'dark'): void {
  const root = document.documentElement;

  if (theme.id === DEFAULT_THEME_ID) {
    clearCustomThemeVariables();
    return;
  }

  const palette =
    theme.id === TACTICAL_OVERLAY_THEME_ID
      ? theme.dark
      : resolved === 'dark'
        ? theme.dark
        : theme.light;
  const isDark = theme.id === TACTICAL_OVERLAY_THEME_ID || resolved === 'dark';

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
  root.setAttribute(
    'data-theme-resolved',
    theme.id === TACTICAL_OVERLAY_THEME_ID ? 'dark' : resolved,
  );
  if (theme.effects === 'tactical' || theme.effects === 'interakt' || theme.effects === 'stitch') {
    root.setAttribute('data-theme-effects', theme.effects);
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
    /* Interakt component tokens for shared inbox chrome inside tactical shell */
    root.style.setProperty('--crm-green', palette.primary);
    root.style.setProperty('--crm-send', palette.primary);
    root.style.setProperty('--crm-send-hover', palette.primaryHover);
    root.style.setProperty('--crm-surface', palette.bgLight);
    root.style.setProperty('--inakt-primary-soft', 'color-mix(in srgb, #22d3ee 14%, transparent)');
    root.style.setProperty('--inakt-outline-variant', palette.border);
    root.style.setProperty('--inakt-bubble-received', palette.bgCard);
    root.style.setProperty('--inakt-chat-bg', palette.bgLight);
    root.style.setProperty('--inakt-surface-container', palette.bgCard);
    root.style.setProperty('--inakt-surface-container-low', palette.bgLight);
    root.style.setProperty('--interakt-surface-glass-high', 'color-mix(in srgb, #03070d 94%, transparent)');
    root.style.setProperty('--interakt-surface-muted-soft', 'color-mix(in srgb, #0f172a 72%, transparent)');
    root.style.setProperty('--interakt-ghost-hover', 'rgba(34, 211, 238, 0.08)');
  } else if (theme.effects === 'interakt') {
    root.style.setProperty('--radius', '8px');
    if (isDark) {
      root.style.setProperty('--crm-green', palette.primary);
      root.style.setProperty('--crm-send', palette.primary);
      root.style.setProperty('--crm-send-hover', palette.primaryHover);
      root.style.setProperty('--crm-surface', palette.bgLight);
      root.style.setProperty('--inakt-primary-container', '#2f8a63');
      root.style.setProperty('--inakt-secondary-fixed', '#1e3a5f');
      root.style.setProperty('--inakt-on-secondary-fixed', '#d8e2ff');
      root.style.setProperty('--inakt-status-ai', '#7b79e8');
      root.style.setProperty('--inakt-bubble-sent', '#1e3d2c');
      root.style.setProperty('--inakt-bubble-received', palette.bgCard);
      root.style.setProperty('--inakt-bubble-sent-border', '#2a5240');
      root.style.setProperty('--inakt-chat-bg', palette.bgLight);
      root.style.setProperty('--inakt-sidebar-bg', 'rgba(15, 22, 18, 0.88)');
      root.style.setProperty('--inakt-outline-variant', palette.border);
      root.style.setProperty('--inakt-read-tick', '#5eb8e8');
      root.style.setProperty('--inakt-ink', palette.textPrimary);
      root.style.setProperty('--inakt-primary-soft', 'color-mix(in srgb, #006d2f 18%, transparent)');
      root.style.setProperty('--inakt-secondary', '#5eb0ff');
      root.style.setProperty('--inakt-secondary-soft', 'color-mix(in srgb, #0058bc 15%, transparent)');
      root.style.setProperty('--inakt-warning', '#f59e0b');
      root.style.setProperty('--inakt-warning-soft', 'color-mix(in srgb, #b45309 12%, transparent)');
      root.style.setProperty('--inakt-danger', '#f87171');
      root.style.setProperty('--inakt-danger-soft', 'color-mix(in srgb, #ba1a1a 12%, transparent)');
      root.style.setProperty('--inakt-ai-soft', 'color-mix(in srgb, #5856D6 12%, transparent)');
      root.style.setProperty('--inakt-surface-sidebar', 'rgba(15, 22, 18, 0.88)');
      root.style.setProperty('--inakt-surface-container', palette.bgCard);
      root.style.setProperty('--inakt-surface-container-low', palette.bgLight);
      root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.35)');
      root.style.setProperty('--shadow-md', '0 1px 3px rgba(0, 0, 0, 0.45)');
      root.style.setProperty('--shadow-lg', '0 4px 12px rgba(0, 0, 0, 0.5)');
    } else {
      root.style.setProperty('--crm-green', '#006d2f');
      root.style.setProperty('--crm-send', '#006d2f');
      root.style.setProperty('--crm-send-hover', '#005322');
      root.style.setProperty('--crm-surface', '#faf9fe');
      root.style.setProperty('--inakt-primary-container', '#25d366');
      root.style.setProperty('--inakt-secondary-fixed', '#d8e2ff');
      root.style.setProperty('--inakt-on-secondary-fixed', '#001a41');
      root.style.setProperty('--inakt-status-ai', '#5856D6');
      root.style.setProperty('--inakt-bubble-sent', '#DCF8C6');
      root.style.setProperty('--inakt-bubble-received', '#FFFFFF');
      root.style.setProperty('--inakt-bubble-sent-border', '#c3e6a4');
      root.style.setProperty('--inakt-chat-bg', '#faf9fe');
      root.style.setProperty('--inakt-sidebar-bg', 'rgba(246, 246, 246, 0.8)');
      root.style.setProperty('--inakt-outline-variant', '#bbcbb9');
      root.style.setProperty('--inakt-read-tick', '#34B7F1');
      root.style.setProperty('--inakt-ink', palette.textPrimary);
      root.style.setProperty('--inakt-primary-soft', '#e8f8ee');
      root.style.setProperty('--inakt-secondary', '#0058bc');
      root.style.setProperty('--inakt-secondary-soft', '#eaf2ff');
      root.style.setProperty('--inakt-warning', '#b45309');
      root.style.setProperty('--inakt-warning-soft', '#fff7ed');
      root.style.setProperty('--inakt-danger', '#ba1a1a');
      root.style.setProperty('--inakt-danger-soft', '#fff1f2');
      root.style.setProperty('--inakt-ai-soft', '#f1f1ff');
      root.style.setProperty('--inakt-surface-sidebar', '#f6f6f6');
      root.style.setProperty('--inakt-surface-container', '#eeedf3');
      root.style.setProperty('--inakt-surface-container-low', '#f4f3f8');
      root.style.setProperty('--shadow-sm', '0 1px 2px rgba(15, 23, 42, 0.05)');
      root.style.setProperty('--shadow-md', '0 1px 3px rgba(15, 23, 42, 0.08)');
      root.style.setProperty('--shadow-lg', '0 4px 12px rgba(15, 23, 42, 0.1)');
    }
  } else if (theme.effects === 'stitch') {
    root.style.setProperty('--radius', '8px');
    root.style.setProperty('--stitch-sidebar-w', '80px');
    root.style.setProperty('--stitch-header-h', '4rem');
    root.style.setProperty('--stitch-chat-header-h', '3.5rem');
    root.style.setProperty('--stitch-crm-panel-w', '380px');
    root.style.setProperty('--stitch-page-bg', palette.bgLight);
    root.style.setProperty('--stitch-mac-red', '#FF5F57');
    root.style.setProperty('--stitch-mac-yellow', '#FEBC2E');
    root.style.setProperty('--stitch-mac-green', '#28C840');
    root.style.setProperty('--stitch-filter-menu-w', '14rem');
    root.style.setProperty('--stitch-radius-panel', '16px');
    root.style.setProperty('--stitch-radius-pill', '9999px');
    root.style.setProperty('--shadow-sm', '0 1px 2px rgba(15, 23, 42, 0.05)');
    root.style.setProperty('--shadow-md', '0 4px 14px rgba(15, 23, 42, 0.08)');
    root.style.setProperty('--shadow-lg', '0 10px 30px -5px rgba(15, 23, 42, 0.12)');
    if (isDark) {
      root.style.setProperty('--stitch-surface-muted', 'color-mix(in srgb, #1f2937 72%, transparent)');
      root.style.setProperty('--stitch-primary-soft', 'color-mix(in srgb, #3b82f6 16%, transparent)');
    } else {
      root.style.setProperty('--stitch-surface-muted', '#F3F6F9');
      root.style.setProperty('--stitch-primary-soft', '#eff6ff');
    }
  }
}

export function createCustomTheme(input: CustomThemeInput): DashboardTheme {
  return {
    id: `custom-${randomId()}`,
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
    id: `custom-${randomId()}`,
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
