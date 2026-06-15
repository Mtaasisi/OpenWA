import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AskAiLink } from '../components/AskAiLink';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { WorkspacePageHeader } from '../components/workspace';
import { CustomersPipelinePanel } from '../components/CustomersPipelinePanel';
import './Customers.css';
import './Pipeline.css';

export function Pipeline() {
  const { t } = useTranslation();
  useDocumentTitle(t('pipeline.title'));

  return (
    <div className="followups-interakt pipeline-interakt">
      <WorkspacePageHeader
        title={t('pipeline.title')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
        extraActions={
          <>
            <AskAiLink prompt={t('ai.prompts.pipeline')} />
            <Link to="/customers" className="fu-btn fu-btn--ghost">
              <MaterialSymbol name="groups" size={16} />
              {t('customers.title')}
            </Link>
            <Link to="/reports?section=pipeline" className="fu-btn fu-btn--ghost">
              <MaterialSymbol name="bar_chart" size={16} />
              {t('pipeline.reportsLink')}
            </Link>
          </>
        }
      />

      <div className="followups-interakt__scroll">
        <CustomersPipelinePanel interakt standalone />
      </div>
    </div>
  );
}
