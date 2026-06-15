import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';

interface Props {
  onAddTag: () => void;
  onBrowseCatalog: () => void;
  onSchedule: () => void;
  onPipeline: () => void;
  onTransfer?: () => void;
  showTransfer?: boolean;
  edition?: boolean;
}

export function InboxInteraktCrmQuickActions({
  onAddTag,
  onBrowseCatalog,
  onSchedule,
  onPipeline,
  edition = false,
}: Props) {
  const { t } = useTranslation();

  const actions: Array<{
    id: string;
    symbol: string;
    label: string;
    onClick: () => void;
  }> = [
    { id: 'tag', symbol: 'label', label: t('inbox.interakt.quickEdit'), onClick: onAddTag },
    { id: 'catalog', symbol: 'storefront', label: t('inbox.interakt.quickCatalogShort'), onClick: onBrowseCatalog },
    { id: 'schedule', symbol: 'calendar_today', label: t('inbox.interakt.quickSchedule'), onClick: onSchedule },
    { id: 'pipeline', symbol: 'account_tree', label: t('inbox.interakt.quickLead'), onClick: onPipeline },
  ];

  return (
    <div className={`inbox-interakt-crm-quick-actions${edition ? ' inbox-interakt-crm-quick-actions--edition' : ''}`}>
      <h4 className="inbox-interakt-crm-quick-actions__title">{t('inbox.interakt.quickActions')}</h4>
      <div className="inbox-interakt-crm-quick-actions__grid">
        {actions.map(({ id, symbol, label, onClick }) => (
          <button
            key={id}
            type="button"
            className="inbox-interakt-crm-quick-actions__btn"
            onClick={onClick}
          >
            <MaterialSymbol name={symbol} size={22} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
