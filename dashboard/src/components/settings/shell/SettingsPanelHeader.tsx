import type { ReactNode } from 'react';
import { MaterialSymbol } from '../../MaterialSymbol';
import { SettingsFormCard } from './SettingsFormPrimitives';

type Props = {
  icon?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  variant?: 'default' | 'detail';
};

export function SettingsPanelHeader({ icon, title, description, variant = 'default' }: Props) {
  return (
    <header
      className={[
        'settings-wa__panel-header',
        variant === 'detail' ? 'settings-wa__panel-header--detail' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon ? (
        <span className="settings-wa__panel-header-icon">
          <MaterialSymbol name={icon} size={22} />
        </span>
      ) : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function SettingsSectionBlock({
  title,
  icon,
  children,
  actions,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <SettingsFormCard icon={icon} title={title} actions={actions}>
      {children}
    </SettingsFormCard>
  );
}
