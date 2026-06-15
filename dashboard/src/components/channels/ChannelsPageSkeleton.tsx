import { useTranslation } from 'react-i18next';

export function ChannelsPageSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="cc-shell cc-shell--loading" aria-busy="true" aria-label={t('common.loading')}>
      <div className="cc-main-col">
        <header className="cc-topbar">
          <div className="cc-skeleton cc-skeleton--search" />
        </header>
        <main className="cc-scroll">
          <div className="cc-skeleton cc-skeleton--head" />
          <div className="cc-skeleton cc-skeleton--tabs" />
          <div className="cc-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="cc-skeleton cc-skeleton--card" />
            ))}
          </div>
        </main>
      </div>
      <aside className="cc-inspector">
        <div className="cc-skeleton cc-skeleton--inspector" />
      </aside>
    </div>
  );
}
