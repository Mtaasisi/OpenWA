import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MaterialSymbol } from '../MaterialSymbol';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import {
  AITCErrorState,
  AITCEmptyState,
  AITCLoadingSkeleton,
  ConfidenceIndicator,
  IntentBadge,
  StatusBadge,
  TrainingMetricCard,
} from './shared';
import { AddNewTrainingModal } from './modals';

export function TrainingDashboardPage() {
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'dashboard'],
    queryFn: () => aiTrainingCenterApi.getDashboard(),
  });

  return (
    <>
      <header className="aitc-page-header">
        <div>
          <h1 className="aitc-page-header__title" data-testid="aitc-dashboard-title">AI Training Center</h1>
          <p className="aitc-page-header__subtitle">
            Train your AI to understand your customers better and reduce costs.
          </p>
        </div>
        <div className="aitc-page-header__actions">
          <button type="button" className="aitc-btn aitc-btn--ghost" onClick={() => navigate('/ai?tab=training&queue=legacy')}>
            How it works?
          </button>
          <button
            type="button"
            className="aitc-btn aitc-btn--secondary"
            onClick={() => navigate('/ai-training-center/settings')}
          >
            Settings
          </button>
          <button type="button" className="aitc-btn aitc-btn--primary" onClick={() => setShowAdd(true)}>
            <MaterialSymbol name="add" size={18} />
            Add Training
          </button>
        </div>
      </header>

      {isError && <AITCErrorState message="Could not load dashboard." onRetry={() => refetch()} />}

      {isLoading ? (
        <AITCLoadingSkeleton rows={8} />
      ) : data ? (
        <>
          <div className="aitc-kpi-grid">
            {data.kpis.map(kpi => (
              <TrainingMetricCard key={kpi.label} {...kpi} />
            ))}
          </div>

          <div className="aitc-grid-2" style={{ marginBottom: '1rem' }}>
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Training overview — Last 7 days</h3>
              <div className="aitc-chart-bars">
                {data.overviewSeries.map(row => (
                  <div key={row.date} className="aitc-chart-bar-group">
                    <div className="aitc-chart-bar-stack">
                      <div
                        className="aitc-chart-bar aitc-chart-bar--blue"
                        style={{ height: `${Math.min(100, row.messagesTrained / 2)}%` }}
                      />
                      <div
                        className="aitc-chart-bar aitc-chart-bar--green"
                        style={{ height: `${Math.min(100, row.aiCallsSaved / 2)}%` }}
                      />
                    </div>
                    <span className="aitc-chart-label">{row.date}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                Blue: Messages trained · Green: AI calls saved
              </p>
            </div>

            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Top intents</h3>
              <div className="aitc-donut" aria-hidden />
              <div className="aitc-donut-legend" style={{ marginTop: '1rem' }}>
                {data.topIntents.map(t => (
                  <div key={t.intent}>{t.intent} — {t.count}%</div>
                ))}
              </div>
            </div>
          </div>

          <div className="aitc-grid-2">
            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Recently trained intents</h3>
              {data.recentTrained.length === 0 ? (
                <AITCEmptyState title="No recent training" description="Train intents from unknown messages." />
              ) : (
                <div className="aitc-table-wrap">
                  <table className="aitc-table">
                    <thead>
                      <tr>
                        <th>Phrase</th>
                        <th>Intent</th>
                        <th>Status</th>
                        <th>Confidence</th>
                        <th>Trained by</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTrained.map(row => (
                        <tr key={row.id}>
                          <td>{row.phrase}</td>
                          <td><IntentBadge intent={row.intent} /></td>
                          <td><StatusBadge status={row.status} /></td>
                          <td><ConfidenceIndicator value={row.confidence} /></td>
                          <td>{row.trainedBy}</td>
                          <td>{new Date(row.date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="aitc-panel-card">
              <h3 className="aitc-panel-card__title">Training status</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.875rem' }}>
                <li className="aitc-toggle-row">
                  <span>Auto learning</span>
                  <strong>{data.status.autoLearningEnabled ? 'Enabled' : 'Disabled'}</strong>
                </li>
                <li className="aitc-toggle-row">
                  <span>Pending review</span>
                  <strong>{data.status.pendingReview}</strong>
                </li>
                <li className="aitc-toggle-row">
                  <span>Unknown messages</span>
                  <strong>{data.status.unknownMessages}</strong>
                </li>
                <li className="aitc-toggle-row">
                  <span>Low confidence</span>
                  <strong>{data.status.lowConfidence}</strong>
                </li>
                <li className="aitc-toggle-row">
                  <span>Disabled intents</span>
                  <strong>{data.status.disabledIntents}</strong>
                </li>
              </ul>
            </div>
          </div>
        </>
      ) : null}

      {showAdd && <AddNewTrainingModal onClose={() => setShowAdd(false)} />}
    </>
  );
}
