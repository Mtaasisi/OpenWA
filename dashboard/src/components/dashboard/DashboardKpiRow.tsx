import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MetricCard } from './index';
import type { DashboardKpi } from '../../lib/dashboard-metrics';

interface DashboardKpiRowProps {
  kpis: DashboardKpi[];
  priorityOnly?: boolean;
  loading?: boolean;
}

export function DashboardKpiRow({ kpis, priorityOnly = false, loading }: DashboardKpiRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const visible = priorityOnly ? kpis.filter(k => k.priority) : kpis;

  return (
    <div className="dashboard-kpi-grid">
      {visible.map(kpi => (
        <MetricCard
          key={kpi.id}
          title={t(kpi.titleKey)}
          value={kpi.value}
          helperText={kpi.helperKey ? t(kpi.helperKey) : undefined}
          trend={kpi.trend}
          trendUp={kpi.trendUp}
          severity={kpi.severity}
          icon={kpi.icon}
          loading={loading}
          onClick={() =>
            navigate(kpi.linkTo, kpi.linkState ? { state: kpi.linkState } : undefined)
          }
        />
      ))}
    </div>
  );
}
