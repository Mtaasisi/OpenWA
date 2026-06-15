import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { EmptyState, QuickActionButton } from './index';
import type { Conversation } from '../../services/api';

interface Props {
  assigned: Conversation[];
  unreadAssigned: number;
  needsReply: number;
}

export function DashboardMyInboxSummary({ assigned, unreadAssigned, needsReply }: Props) {
  const { t } = useTranslation();

  return (
    <DashboardSection
      title={t('dashboard.myWorkspace.inboxSummary')}
      icon={<MaterialSymbol name="inbox" size={20} className="dash-section__title-icon" />}
      linkTo="/inbox"
      linkLabel={t('dashboard.myWorkspace.openInbox')}
      className="dash-section--compact"
    >
      {assigned.length === 0 ? (
        <EmptyState
          title={t('dashboard.myWorkspace.inboxEmpty')}
          description={t('dashboard.myWorkspace.inboxEmptyDesc')}
        />
      ) : (
        <div className="dash-my-inbox-stats">
          <div className="dash-my-inbox-stat">
            <strong>{assigned.length}</strong>
            <span>{t('dashboard.myWorkspace.assignedOpen')}</span>
          </div>
          <div className="dash-my-inbox-stat">
            <strong>{unreadAssigned}</strong>
            <span>{t('dashboard.myWorkspace.unreadAssigned')}</span>
          </div>
          <div className="dash-my-inbox-stat">
            <strong>{needsReply}</strong>
            <span>{t('dashboard.myWorkspace.needsReply')}</span>
          </div>
          <QuickActionButton
            label={t('dashboard.myWorkspace.viewAssigned')}
            to="/inbox"
            linkState={{ filter: 'assigned_to_me' }}
            className="dash-my-inbox-stat-action"
          />
        </div>
      )}
    </DashboardSection>
  );
}
