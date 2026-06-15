import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import {
  AITCErrorState,
  AITCLoadingSkeleton,
  ConfidenceIndicator,
  IntentBadge,
  TrainingMetricCard,
} from './shared';

const RANGE_OPTS = ['7', '30', 'mtd'] as const;

export function TrainingAnalyticsPage() {
  const [range, setRange] = useState<string>('7');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'analytics', range],
    queryFn: () => aiTrainingCenterApi.getAnalytics(range),
  });

  return (
    <>
      <header className="aitc-page-header">
        <div>
          <h1 className="aitc-page-header__title">Training Analytics</h1>
          <p className="aitc-page-header__subtitle">Track your AI training performance and impact.</p>
        </div>
        <div className="aitc-page-header__actions">
          {RANGE_OPTS.map(r => (
            <button
              key={r}
              type="button"
              className={`aitc-tab${range === r ? ' is-active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r === '7' ? 'Last 7 days' : r === '30' ? 'Last 30 days' : 'Month to date'}
            </button>
          ))}
        </div>
      </header>

      {isError && <AITCErrorState message="Failed to load analytics." onRetry={() => refetch()} />}
      {isLoading ? (
        <AITCLoadingSkeleton rows={10} />
      ) : data ? (
        <>
          <div className="aitc-kpi-grid">
            {data.kpis.map(k => <TrainingMetricCard key={k.label} {...k} />)}
          </div>

          <div className="aitc-grid-2" style={{ marginBottom: '1rem' }}>
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Cache hit rate over time</h3>
              <div className="aitc-chart-bars">
                {data.cacheHitSeries.slice(-7).map((row, i) => (
                  <div key={i} className="aitc-chart-bar-group">
                    <div className="aitc-chart-bar-stack">
                      <div
                        className="aitc-chart-bar aitc-chart-bar--blue"
                        style={{ height: `${row.rate}%` }}
                      />
                    </div>
                    <span className="aitc-chart-label">{row.date}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Intents by status</h3>
              <div className="aitc-donut" />
              <div className="aitc-donut-legend" style={{ marginTop: '1rem' }}>
                {data.intentsByStatus.map(s => (
                  <div key={s.status}>{s.status}: {s.count}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="aitc-grid-2">
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Cost saved over time</h3>
              <div className="aitc-chart-bars">
                {data.costSavedSeries.slice(-7).map((row, i) => (
                  <div key={i} className="aitc-chart-bar-group">
                    <div className="aitc-chart-bar-stack">
                      <div
                        className="aitc-chart-bar aitc-chart-bar--green"
                        style={{ height: `${row.amount * 30}%` }}
                      />
                    </div>
                    <span className="aitc-chart-label">{row.date}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Unknown messages trend</h3>
              <div className="aitc-chart-bars">
                {data.unknownTrend.slice(-7).map((row, i) => (
                  <div key={i} className="aitc-chart-bar-group">
                    <div className="aitc-chart-bar-stack">
                      <div
                        className="aitc-chart-bar aitc-chart-bar--blue"
                        style={{ height: `${row.count * 8}%` }}
                      />
                    </div>
                    <span className="aitc-chart-label">{row.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="aitc-grid-2" style={{ marginTop: '1rem' }}>
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Top phrases saving AI cost</h3>
              <ul style={{ padding: 0, listStyle: 'none', fontSize: '0.875rem' }}>
                {data.topSavingPhrases.map(p => (
                  <li key={p.phrase} className="aitc-toggle-row">
                    <span>{p.phrase}</span>
                    <strong>{p.savedCalls} calls saved</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Low confidence intents</h3>
              {data.lowConfidenceIntents.map(i => (
                <div key={i.id} className="aitc-toggle-row">
                  <span>
                    <IntentBadge intent={i.intent} /> {i.phrase}
                  </span>
                  <ConfidenceIndicator value={i.confidence} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
