export type AppearanceMode = 'light' | 'dark' | 'system';

/** CSS variable values applied on :root */
export interface ThemePalette {
  primary: string;
  primaryHover: string;
  bgLight: string;
  bgWhite: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}

/** Optional UI kit applied via dedicated stylesheets (tactical HUD, Interakt inbox, Stitch Digital Reconstruction). */
export type ThemeEffects = 'tactical' | 'interakt' | 'stitch';

export interface DashboardTheme {
  id: string;
  name: string;
  description?: string;
  builtin: boolean;
  light: ThemePalette;
  dark: ThemePalette;
  /** Enables extra stylesheet effects (scanline, grid, sharp HUD chrome). */
  effects?: ThemeEffects;
}

export type CustomThemeInput = Pick<DashboardTheme, 'name' | 'description' | 'light' | 'dark'>;
