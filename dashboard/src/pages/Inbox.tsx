import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTheme } from '../hooks/useTheme';
import { PageHeader } from '../components/PageHeader';
import { useInboxController } from './useInboxController';
import { InboxTacticalView } from './InboxTacticalView';
import { InboxClassicView } from './InboxClassicView';
import { SessionQrModal } from '../components/SessionQrModal';
import './Inbox.css';

export function Inbox() {
  const { t } = useTranslation();
  useDocumentTitle(t('inbox.title'));
  const ctrl = useInboxController();
  const { activeTheme } = useTheme();

  if (ctrl.loadingSessions) {
    return (
      <div className="inbox-state-banner">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (ctrl.allSessions.length === 0) {
    return (
      <div className="inbox-page">
        <PageHeader title={t('inbox.title')} subtitle={t('inbox.subtitle')} />
        <div className="inbox-empty-state">
          <p className="inbox-empty-state-title">{t('inbox.noSessions')}</p>
          <Link to="/sessions" className="inbox-link-btn">
            {t('inbox.goToSessions')}
          </Link>
        </div>
      </div>
    );
  }

  if (activeTheme.effects === 'tactical') {
    return (
      <>
        <InboxTacticalView ctrl={ctrl} />
        {ctrl.qrModal && <SessionQrModal data={ctrl.qrModal} onClose={ctrl.closeQrModal} />}
      </>
    );
  }

  return (
    <>
      <InboxClassicView ctrl={ctrl} />
      {ctrl.qrModal && <SessionQrModal data={ctrl.qrModal} onClose={ctrl.closeQrModal} />}
    </>
  );
}
