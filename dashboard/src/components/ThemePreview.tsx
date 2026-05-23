import type { DashboardTheme } from '../lib/theme-types';

export function ThemePreview({ theme, mode }: { theme: DashboardTheme; mode: 'light' | 'dark' }) {
  const p = mode === 'dark' ? theme.dark : theme.light;
  const isTactical = theme.effects === 'tactical';
  return (
    <div
      className={`theme-preview ${isTactical ? 'theme-preview--tactical' : ''}`}
      style={{
        background: p.bgLight,
        borderColor: isTactical ? 'rgba(34, 211, 238, 0.25)' : p.border,
        color: p.textPrimary,
      }}
    >
      <div className="theme-preview__bar" style={{ background: p.bgWhite, borderColor: p.border }}>
        <span className="theme-preview__dot" style={{ background: p.primary }} />
        <span className="theme-preview__line" style={{ background: p.border }} />
      </div>
      <div className="theme-preview__body">
        <div className="theme-preview__card" style={{ background: p.bgCard, borderColor: p.border }}>
          <div className="theme-preview__title" style={{ color: p.textPrimary }} />
          <div className="theme-preview__text" style={{ background: p.textMuted }} />
          <div className="theme-preview__btn" style={{ background: p.primary }} />
        </div>
      </div>
    </div>
  );
}
