import type { ReactNode } from 'react';
import { SettingsFormPage } from './SettingsFormPrimitives';

type Props = {
  title: string;
  icon?: string;
  description?: string;
  children: ReactNode;
};

export function SettingsHubPage({ title, icon, description, children }: Props) {
  return (
    <SettingsFormPage wide title={title} icon={icon} intro={description}>
      <div className="settings-hub">{children}</div>
    </SettingsFormPage>
  );
}
