import type { ReactNode } from 'react';
import { SettingsFormPage } from './SettingsFormPrimitives';

type Props = {
  icon?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
};

export function SettingsDetailPage({ title, icon, description, children, wide }: Props) {
  return (
    <SettingsFormPage wide={wide} title={title} icon={icon} intro={description}>
      {children}
    </SettingsFormPage>
  );
}
