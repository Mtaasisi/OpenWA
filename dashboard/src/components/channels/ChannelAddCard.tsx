import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';

type Props = {
  onClick: () => void;
};

export function ChannelAddCard({ onClick }: Props) {
  const { t } = useTranslation();

  return (
    <div
      role="button"
      tabIndex={0}
      className="cc-card cc-card--add"
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="cc-card__add-icon">
        <MaterialSymbol name="add" size={22} />
      </div>
      <span className="cc-card__add-label">{t('channels.addChannel')}</span>
    </div>
  );
}
