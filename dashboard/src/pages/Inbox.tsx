import { Link, useOutletContext } from 'react-router-dom';
import type { LayoutOutletContext } from '../lib/layout-outlet-context';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTheme } from '../hooks/useTheme';
import { PageHeader } from '../components/PageHeader';
import { AskAiLink } from '../components/AskAiLink';
import { useInboxController } from './useInboxController';
import { useInboxAiAlerts } from '../hooks/useInboxAiAlerts';
import {
  InboxWorkspaceView,
  inboxVariantFromEffects,
} from './InboxWorkspaceView';
import { InboxSharedModals } from './InboxSharedModals';
import { channelsUrl } from '../lib/channel-routes';
import './Inbox.css';

export function Inbox() {
  const { t } = useTranslation();
  useDocumentTitle(t('inbox.title'));
  const layoutCtx = useOutletContext<LayoutOutletContext>();
  const ctrl = useInboxController();
  useInboxAiAlerts();
  const { activeTheme } = useTheme();
  const variant = inboxVariantFromEffects(activeTheme.effects);

  if (ctrl.sessionsInitialLoad) {
    return (
      <div className="inbox-state-banner">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (ctrl.allSessions.length === 0) {
    return (
      <div className="inbox-page">
        <PageHeader
          title={t('inbox.title')}
          subtitle={t('inbox.subtitle')}
          actions={<AskAiLink prompt={t('ai.prompts.inbox')} />}
        />
        <div className="inbox-empty-state">
          <p className="inbox-empty-state-title">{t('inbox.noSessions')}</p>
          <Link to={channelsUrl({ channel: 'whatsapp', add: true })} className="fu-btn fu-btn--primary">
            {t('channels.addChannel')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <InboxWorkspaceView ctrl={ctrl} layoutCtx={layoutCtx} variant={variant} />
      <InboxSharedModals ctrl={ctrl} />
    </>
  );
}
