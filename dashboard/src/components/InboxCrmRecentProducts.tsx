import { useTranslation } from 'react-i18next';
import type { InboxMessage } from '../services/api';
import type { InteraktRecentProduct } from '../pages/inbox-helpers';
import { MaterialSymbol } from './MaterialSymbol';
import { ProductCard } from './workspace';
import { InboxProductPicker } from './InboxProductPicker';

interface Props {
  labels?: string[];
  products?: InteraktRecentProduct[];
  sessionId?: string;
  chatId?: string;
  sessionStatus?: string;
  canWrite: boolean;
  onStartSession?: (sessionId: string) => void;
  onSent?: () => void;
  addOptimisticMessage?: (message: InboxMessage) => void;
  removeOptimisticMessage?: (id: string) => void;
  catalogOpenSignal?: number;
  onBrowseCatalog?: () => void;
  variant?: 'interakt' | 'classic' | 'tactical';
}

/** Recent product interest labels + catalog browse link (shared CRM). */
export function InboxCrmRecentProducts({
  labels = [],
  products,
  sessionId,
  chatId,
  sessionStatus,
  canWrite,
  onStartSession,
  onSent,
  addOptimisticMessage,
  removeOptimisticMessage,
  catalogOpenSignal,
  onBrowseCatalog,
  variant = 'classic',
}: Props) {
  const { t } = useTranslation();
  const items: InteraktRecentProduct[] =
    products ?? labels.map(name => ({ name }));

  const wrapClass =
    variant === 'interakt'
      ? 'inbox-interakt-crm-recent-products'
      : variant === 'tactical'
        ? 'tac-recent-products'
        : 'inbox-crm-recent-products';

  const titleClass =
    variant === 'interakt'
      ? 'inbox-interakt-crm-recent-products__title'
      : variant === 'tactical'
        ? 'tac-recent-products__title'
        : 'inbox-crm-recent-products__title';

  const listClass =
    variant === 'interakt'
      ? 'inbox-interakt-crm-recent-products__list'
      : variant === 'tactical'
        ? 'tac-recent-products__list'
        : 'inbox-crm-recent-products__list';

  const itemClass =
    variant === 'interakt'
      ? 'inbox-interakt-crm-recent-products__item'
      : variant === 'tactical'
        ? 'tac-recent-products__item'
        : 'inbox-crm-recent-products__item';

  const hintClass =
    variant === 'interakt'
      ? 'inbox-interakt-crm-recent-products__hint'
      : variant === 'tactical'
        ? 'tac-recent-products__hint'
        : 'inbox-crm-recent-products__hint';

  const linkClass =
    variant === 'interakt'
      ? 'inbox-interakt-crm-recent-products__link'
      : variant === 'tactical'
        ? 'tac-recent-products__link'
        : 'inbox-crm-catalog-link';

  const catalogPicker =
    sessionId && chatId ? (
      <InboxProductPicker
        sessionId={sessionId}
        chatId={chatId}
        sessionStatus={sessionStatus}
        canWrite={canWrite}
        onStartSession={onStartSession}
        onSent={onSent}
        addOptimisticMessage={addOptimisticMessage}
        removeOptimisticMessage={removeOptimisticMessage}
        linkTrigger={
          variant === 'interakt'
            ? undefined
            : {
                label: t('inbox.interakt.browseCatalog'),
                className: linkClass,
              }
        }
        headless={variant === 'interakt'}
        openSignal={catalogOpenSignal}
      />
    ) : null;

  if (variant === 'interakt') {
    return (
      <div className={`${wrapClass} inbox-interakt-crm-recent-products--edition`}>
        {items.length > 0 ? (
          <div className="inbox-interakt-crm-recent-products__rows">
            {items.map(item => (
              <ProductCard
                key={item.name}
                layout="row"
                className="inbox-interakt-crm-recent-products__row"
                name={item.name}
                price={item.priceLabel ?? null}
                actions={
                  <MaterialSymbol
                    name="chevron_right"
                    size={18}
                    className="inbox-interakt-crm-recent-products__row-chevron"
                  />
                }
              />
            ))}
          </div>
        ) : (
          <>
            <p className={hintClass}>{t('inbox.interakt.crmRecentProductsHint')}</p>
            {onBrowseCatalog && (
              <button type="button" className={linkClass} onClick={onBrowseCatalog} disabled={!canWrite}>
                {t('inbox.interakt.catalogLink')}
              </button>
            )}
          </>
        )}
        {catalogPicker}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <h4 className={titleClass}>{t('inbox.interakt.crmRecentProducts')}</h4>
      {items.length > 0 ? (
        <ul className={listClass}>
          {items.map(item => (
            <li key={item.name} className={itemClass}>
              {item.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className={hintClass}>{t('inbox.interakt.crmRecentProductsHint')}</p>
      )}
      {catalogPicker}
    </div>
  );
}
