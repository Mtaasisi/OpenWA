import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import './workspace-interakt.css';

type Props = {
  onClick: () => void;
  variant?: 'inline' | 'floating';
};

export function SidebarReopenButton({ onClick, variant = 'inline' }: Props) {
  const { t } = useTranslation();
  const className =
    variant === 'floating' ? 'sidebar-interakt-reopen' : 'fu-header__sidebar-reopen';

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      title={t('sidebar.reopen')}
      aria-label={t('sidebar.reopen')}
    >
      <MaterialSymbol name="left_panel_open" size={20} />
    </button>
  );
}
