import type { SettingsCategoryId, SettingsItem, SettingsNavAccess } from '../settings-types';
import { AiCategoryHub } from './AiCategoryHub';
import { ProfileCategoryHub } from './ProfileCategoryHub';
import { GenericCategoryHub } from './GenericCategoryHub';

type Props = {
  categoryId: SettingsCategoryId;
  access: SettingsNavAccess;
  onSelectItem: (item: SettingsItem) => void;
};

export function SettingsCategoryHub({ categoryId, access, onSelectItem }: Props) {
  if (categoryId === 'profile') {
    return <ProfileCategoryHub onSelectItem={onSelectItem} />;
  }
  if (categoryId === 'ai') {
    return <AiCategoryHub access={access} onSelectItem={onSelectItem} />;
  }
  return (
    <GenericCategoryHub
      categoryId={categoryId}
      access={access}
      onSelectItem={onSelectItem}
    />
  );
}
