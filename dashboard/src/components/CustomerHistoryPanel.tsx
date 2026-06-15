import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Receipt } from 'lucide-react';
import { quoteApi, type PipelineCard } from '../services/api';

interface Props {
  card: PipelineCard;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtMoney(amount: number, currency?: string | null): string {
  const n = amount.toLocaleString();
  return currency?.trim() ? `${currency.trim()} ${n}` : n;
}

export function CustomerHistoryPanel({ card }: Props) {
  const { t } = useTranslation();
  const hasThread = !card.isManual && card.sessionId !== 'manual';
  const inauzwaId = card.inauzwaCustomerId ?? card.customerId ?? null;

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes', 'thread', card.sessionId, card.chatId],
    queryFn: () =>
      quoteApi.list({
        sessionId: card.sessionId,
        chatId: card.chatId,
      }),
    enabled: hasThread,
  });

  const { data: proformas = [], isLoading: proformasLoading } = useQuery({
    queryKey: ['inauzwa', 'proformas', inauzwaId],
    queryFn: () => quoteApi.listInauzwaProformas(inauzwaId!),
    enabled: !!inauzwaId,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['inauzwa', 'sales', inauzwaId],
    queryFn: () => quoteApi.listInauzwaSales(inauzwaId!),
    enabled: !!inauzwaId,
  });

  return (
    <div className="customer-history">
      {hasThread && (
        <section className="customer-history__section">
          <h4>
            <FileText size={14} /> {t('customers.history.quotes')}
          </h4>
          {quotesLoading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : quotes.length === 0 ? (
            <p className="customer-history__muted">{t('customers.history.quotesEmpty')}</p>
          ) : (
            <ul className="customer-history__list">
              {quotes.slice(0, 8).map((q) => (
                <li key={q.id} className="customer-history__row">
                  <div>
                    <strong>{q.quoteNumber}</strong>
                    <span className="customer-history__sub">{q.status}</span>
                  </div>
                  <span>{fmtMoney(q.totalAmount, q.currency)}</span>
                  <span className="customer-history__date">{fmtDate(q.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {inauzwaId && (
        <>
          <section className="customer-history__section">
            <h4>
              <Receipt size={14} /> {t('customers.history.proformas')}
            </h4>
            {proformasLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : proformas.length === 0 ? (
              <p className="customer-history__muted">{t('customers.history.proformasEmpty')}</p>
            ) : (
              <ul className="customer-history__list">
                {proformas.map((p) => (
                  <li key={p.id} className="customer-history__row">
                    <div>
                      <strong>{p.proformaNumber}</strong>
                      <span className="customer-history__sub">{p.status}</span>
                    </div>
                    <span>{fmtMoney(p.total)}</span>
                    <span className="customer-history__date">{fmtDate(p.validUntil)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="customer-history__section">
            <h4>{t('customers.history.sales')}</h4>
            {salesLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : sales.length === 0 ? (
              <p className="customer-history__muted">{t('customers.history.salesEmpty')}</p>
            ) : (
              <ul className="customer-history__list">
                {sales.map((s) => (
                  <li key={s.id} className="customer-history__row">
                    <div>
                      <strong>{s.saleNumber ?? s.id.slice(0, 8)}</strong>
                      {s.paymentStatus && (
                        <span className="customer-history__sub">{s.paymentStatus}</span>
                      )}
                    </div>
                    <span>{fmtMoney(s.total)}</span>
                    <span className="customer-history__date">{fmtDate(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
