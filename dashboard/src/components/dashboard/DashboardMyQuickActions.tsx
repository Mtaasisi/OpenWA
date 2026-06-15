import { useTranslation } from 'react-i18next';
import { MessageSquare, BellRing, FileText } from 'lucide-react';
import { DashboardSection } from './DashboardSection';
import { QuickActionButton } from './index';
import { MaterialSymbol } from '../MaterialSymbol';

export function DashboardMyQuickActions() {
  const { t } = useTranslation();

  return (
    <DashboardSection
      title={t('dashboard.myWorkspace.quickActions')}
      icon={<MaterialSymbol name="bolt" size={20} className="dash-section__title-icon" />}
    >
      <div className="dash-my-quick-actions">
        <QuickActionButton
          label={t('nav.inbox')}
          to="/inbox"
          icon={MessageSquare}
          variant="primary"
        />
        <QuickActionButton label={t('nav.followups')} to="/followups" icon={BellRing} />
        <QuickActionButton label={t('nav.templates')} to="/templates" icon={FileText} />
      </div>
    </DashboardSection>
  );
}
