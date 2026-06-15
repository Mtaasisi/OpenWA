import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import type { PipelineStageDisplay } from '../../lib/dashboard-metrics';

const STAGE_CLASS: Record<string, string> = {
  hot: 'dash-pipeline-stage--hot',
  payment: 'dash-pipeline-stage--payment',
  won: 'dash-pipeline-stage--won',
  quoted: 'dash-pipeline-stage--quoted',
};

interface DashboardSalesPipelineProps {
  stages: PipelineStageDisplay[];
  compact?: boolean;
}

export function DashboardSalesPipeline({ stages, compact }: DashboardSalesPipelineProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.salesPipeline')}
      subtitle={compact ? undefined : t('dashboard.controlRoom.pipelineSubtitle')}
      icon={<MaterialSymbol name="receipt_long" size={20} className="dash-section__title-icon" />}
      linkTo="/pipeline"
      linkLabel={t('dashboard.controlRoom.openPipeline')}
      className="dash-section--pipeline-glow"
    >
      <div className="dash-pipeline-stages">
        {stages.map((stage, index) => (
          <div key={stage.id} className="dash-pipeline-stage-wrap">
            {index > 0 && <ChevronRight size={16} className="dash-pipeline-chevron" aria-hidden />}
            <button
              type="button"
              className={`dash-pipeline-stage ${STAGE_CLASS[stage.id] ?? ''}`.trim()}
              onClick={() => navigate(stage.linkTo)}
            >
              <span className="dash-pipeline-stage__count">{stage.count}</span>
              <span className="dash-pipeline-stage__label">{t(stage.labelKey)}</span>
              {stage.subLabel && (
                <span className="dash-pipeline-stage__sub">{stage.subLabel}</span>
              )}
            </button>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
