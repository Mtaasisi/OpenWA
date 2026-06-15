import type { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string | null;
  aside?: ReactNode;
};

export function SettingsSectionHero({ title, description, aside }: Props) {
  return (
    <section className="settings-section-hero">
      <div className="settings-section-hero__text">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {aside ? <div className="settings-section-hero__aside">{aside}</div> : null}
    </section>
  );
}
