import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { aiApi } from '../../services/api';
import { MaterialSymbol } from '../MaterialSymbol';
import type { SettingsPanelId } from './settings-nav-registry';
import './AiSetupChecklist.css';

const ITEM_LINKS: Partial<Record<string, SettingsPanelId>> = {
  apiKey: 'ai',
  enabled: 'ai',
  autoReply: 'ai',
  knowledgeIndexed: 'ai-knowledge',
  knowledgeFiles: 'ai-knowledge',
  branchProfile: 'ai-branch-profile',
  paymentAccount: 'ai-branch-profile',
};

type Props = {
  onNavigate?: (id: SettingsPanelId) => void;
  onNavigateAutoReply?: () => void;
  compact?: boolean;
  variant?: 'default' | 'hub';
};

export function AiSetupChecklist({
  onNavigate,
  onNavigateAutoReply,
  compact = false,
  variant = 'default',
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.getStatus(),
  });

  const setup = data?.setup;
  if (isLoading) {
    return (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }
  if (!setup) return null;

  if (setup.ready && compact) return null;

  return (
    <section
      className={[
        'ai-setup-interakt',
        setup.ready ? 'is-ready' : '',
        variant === 'hub' ? 'ai-setup-interakt--hub' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="ai-setup-interakt__status-row">
        <div>
          <strong>{t('ai.setup.statusLabel')}:</strong>{' '}
          <span className="ai-setup-interakt__badge">
            {setup.ready ? t('ai.setup.statusReady') : t('ai.setup.statusPending')}
          </span>
        </div>
        <span className="ai-setup-interakt__progress">
          {t('ai.setup.progress', { completed: setup.completed, total: setup.total })}
        </span>
      </div>

      <div className="ai-setup-interakt__card">
        {variant !== 'hub' ? (
          <div className="ai-setup-interakt__watermark" aria-hidden>
            <MaterialSymbol name="psychology" size={120} />
          </div>
        ) : null}
        <h2>{t('ai.setup.title')}</h2>
        {!setup.ready ? (
          <p className="ai-setup-interakt__hint">{t('ai.setup.hint')}</p>
        ) : (
          <p className="ai-setup-interakt__hint">{t('ai.setup.ready')}</p>
        )}
        {!setup.ready && !setup.items.find(i => i.id === 'paymentAccount')?.ok ? (
          <p className="ai-setup-interakt__hint ai-setup-interakt__hint--tip">
            {t('ai.setup.paymentEnvHint')}
          </p>
        ) : null}

        <ul className="ai-setup-interakt__grid">
          {setup.items.map(item => {
            const linkId = item.id === 'autoReply' ? undefined : ITEM_LINKS[item.id];
            const label = t(`ai.setup.items.${item.id}`);
            const mark = item.ok ? (
              <span className="ai-setup-checklist__mark is-ok" aria-hidden>
                <MaterialSymbol name="check" size={14} />
              </span>
            ) : (
              <span className="ai-setup-checklist__mark" aria-hidden />
            );
            const content = (
              <>
                {mark}
                <span className={`ai-setup-checklist__label${item.ok ? ' is-done' : ''}`}>
                  {label}
                  {item.detail ? (
                    <span className="ai-setup-checklist__detail">{item.detail}</span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li key={item.id}>
                {item.id === 'autoReply' && onNavigateAutoReply && !item.ok ? (
                  <button
                    type="button"
                    className="ai-setup-checklist__item--link"
                    onClick={onNavigateAutoReply}
                  >
                    {content}
                  </button>
                ) : linkId && onNavigate && !item.ok ? (
                  <button
                    type="button"
                    className="ai-setup-checklist__item--link"
                    onClick={() => onNavigate(linkId)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="ai-setup-checklist__item">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
