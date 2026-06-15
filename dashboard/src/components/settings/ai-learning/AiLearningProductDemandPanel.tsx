import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  aiLearningApi,
  productDemandApi,
  type AiLearningItem,
  type AiLearningKnowledge,
  type MissingProductRequest,
  type ProductCatalogRequest,
} from '../../../services/api';
import { AiLearningImportSection } from './AiLearningImportSection';
import {
  CreateProductRequestModal,
  ProductCatalogRequestModal,
  EditApprovedKnowledgeModal,
  EditSuggestedAnswerModal,
  LearningHistoryDetailsModal,
  LearningSettingsModal,
  MapMissingProductModal,
  ProductDemandDetailsModal,
  RecommendationActionModal,
  ReviewUnknownQuestionModal,
} from './AiLearningModals';
import {
  ProductDemandFilterBar,
  filtersToQueryParams,
  type ProductDemandFilters,
} from './ProductDemandFilterBar';
import { downloadCsv } from './export-csv';
import {
  catalogRequestStatusFilters,
  formatCatalogRequestStatus,
  formatLearningOutcome,
  type CatalogRequestStatusFilter,
} from './learning-i18n';
import './ai-learning.css';

const TABS = [
  'overview',
  'pending',
  'suggested',
  'approved',
  'demand',
  'missing',
  'requests',
  'recommendations',
  'history',
  'settings',
] as const;

type Tab = (typeof TABS)[number];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AiLearningProductDemandPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const [reviewItem, setReviewItem] = useState<AiLearningItem | null>(null);
  const [editSuggested, setEditSuggested] = useState<AiLearningItem | null>(null);
  const [editKnowledge, setEditKnowledge] = useState<AiLearningKnowledge | null>(null);
  const [demandDetail, setDemandDetail] = useState<string | null>(null);
  const [mapMissing, setMapMissing] = useState<string | null>(null);
  const [recAction, setRecAction] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<AiLearningItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [demandFilters, setDemandFilters] = useState<ProductDemandFilters>({});
  const [createRequestFor, setCreateRequestFor] = useState<MissingProductRequest | 'new' | null>(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState<CatalogRequestStatusFilter>('active');
  const [catalogRequestDetail, setCatalogRequestDetail] = useState<ProductCatalogRequest | null>(null);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['ai-learning', 'overview'],
    queryFn: () => aiLearningApi.getOverview(),
  });

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['ai-learning', 'items', 'pending'],
    queryFn: () => aiLearningApi.listItems({ status: 'pending_review' }),
    enabled: tab === 'pending' || tab === 'overview',
  });

  const { data: suggested = [] } = useQuery({
    queryKey: ['ai-learning', 'items', 'suggested'],
    queryFn: () => aiLearningApi.listItems({ status: 'suggested' }),
    enabled: tab === 'suggested',
  });

  const { data: knowledge = [] } = useQuery({
    queryKey: ['ai-learning', 'knowledge'],
    queryFn: () => aiLearningApi.listKnowledge(),
    enabled: tab === 'approved',
  });

  const { data: history = [] } = useQuery({
    queryKey: ['ai-learning', 'history'],
    queryFn: () => aiLearningApi.listHistory(),
    enabled: tab === 'history',
  });

  const { data: demandOverview } = useQuery({
    queryKey: ['product-demand', 'overview'],
    queryFn: () => productDemandApi.getOverview(),
    enabled: tab === 'demand' || tab === 'overview',
  });

  const { data: demandItems = [] } = useQuery({
    queryKey: ['product-demand', 'items', demandFilters],
    queryFn: () => productDemandApi.listItems(filtersToQueryParams(demandFilters)),
    enabled: tab === 'demand',
  });

  const { data: missing = [] } = useQuery({
    queryKey: ['product-demand', 'missing'],
    queryFn: () => productDemandApi.listMissing(),
    enabled: tab === 'missing',
  });

  const { data: catalogRequests = [] } = useQuery({
    queryKey: ['product-demand', 'product-requests', requestStatusFilter],
    queryFn: () => productDemandApi.listProductRequests(requestStatusFilter),
    enabled: tab === 'requests',
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['product-demand', 'recommendations'],
    queryFn: () => productDemandApi.listRecommendations(),
    enabled: tab === 'recommendations',
  });

  const { data: settings } = useQuery({
    queryKey: ['ai-learning', 'settings'],
    queryFn: () => aiLearningApi.getSettings(),
    enabled: tab === 'settings' || settingsOpen,
  });

  const demandDetailRow = demandItems.find(d => d.id === demandDetail);
  const missingRow = missing.find(m => m.id === mapMissing);
  const recRow = recommendations.find(r => r.id === recAction);

  const tabLabel = (id: Tab) => t(`ai.learning.tabs.${id}`, id);

  return (
    <div className="ail-panel settings-ail-embed">
      <div className="ail-training-center-banner" data-testid="settings-ai-training-center-link">
        <div>
          <strong>{t('ai.training.settingsBannerTitle', { defaultValue: 'AI Training Center' })}</strong>
          <p className="ail-muted">
            {t('ai.training.settingsBannerBody', {
              defaultValue: 'Review inbox learning, MCQ options, backups, and apply flow in the AI Assistant.',
            })}
          </p>
        </div>
        <Link to="/ai-training-center/dashboard" className="ail-btn ail-btn--primary">
          {t('ai.training.openCenter', { defaultValue: 'Open Training Center' })}
        </Link>
      </div>
      <div className="ail-tabs wa-safety-tabs settings-tabs" role="tablist">
        {TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`settings-tab ail-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {tabLabel(id)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {overviewLoading ? (
            <div className="settings-integration-loading">
              <Loader2 className="spin" size={24} />
            </div>
          ) : (
            <div className="ail-kpi-row">
              <div className="ail-kpi"><div className="ail-kpi__label">{t('ai.learning.kpi.pending')}</div><div className="ail-kpi__value">{overview?.pendingLearning ?? 0}</div></div>
              <div className="ail-kpi"><div className="ail-kpi__label">{t('ai.learning.kpi.unknownToday')}</div><div className="ail-kpi__value">{overview?.unknownQuestionsToday ?? 0}</div></div>
              <div className="ail-kpi"><div className="ail-kpi__label">{t('ai.learning.kpi.mostProduct')}</div><div className="ail-kpi__value ail-muted" style={{ fontSize: '0.9rem' }}>{overview?.mostAskedProduct ?? '—'}</div></div>
              <div className="ail-kpi"><div className="ail-kpi__label">{t('ai.learning.kpi.oos')}</div><div className="ail-kpi__value">{overview?.outOfStockDemand ?? 0}</div></div>
              <div className="ail-kpi"><div className="ail-kpi__label">{t('ai.learning.kpi.installment')}</div><div className="ail-kpi__value">{overview?.installmentDemand ?? 0}</div></div>
              <div className="ail-kpi"><div className="ail-kpi__label">{t('ai.learning.kpi.paused')}</div><div className="ail-kpi__value">{overview?.aiPausedChats ?? 0}</div></div>
            </div>
          )}
          <AiLearningImportSection />
          {pending.length > 0 && (
            <p className="ail-muted">{t('ai.learning.overview.pendingHint', { count: pending.length })}</p>
          )}
          {demandOverview && (
            <p className="ail-muted">{t('ai.learning.overview.demandHint')}</p>
          )}
        </>
      )}

      {tab === 'pending' && (
        <>
          <div className="ail-toolbar-row">
            <button
              type="button"
              className="ail-btn"
              onClick={() =>
                downloadCsv(
                  'pending-questions.csv',
                  [
                    t('ai.learning.table.question'),
                    t('ai.learning.table.intent'),
                    t('ai.learning.table.confidence'),
                    t('ai.learning.table.times'),
                    t('ai.learning.table.priority'),
                    t('ai.learning.table.created'),
                  ],
                  pending.map(r => [
                    r.question,
                    r.detectedIntent ?? '',
                    `${Math.round(r.confidenceScore * 100)}%`,
                    String(r.timesAsked),
                    r.priority,
                    formatDate(r.createdAt),
                  ]),
                )
              }
            >
              {t('ai.learning.exportCsv')}
            </button>
          </div>
          <div className="ail-table-wrap">
            {pendingLoading ? (
              <div className="settings-integration-loading">
                <Loader2 className="spin" size={24} />
              </div>
            ) : (
              <table className="ail-table">
                <thead>
                  <tr>
                    <th>{t('ai.learning.table.question')}</th>
                    <th>{t('ai.learning.table.intent')}</th>
                    <th>{t('ai.learning.table.confidence')}</th>
                    <th>{t('ai.learning.table.times')}</th>
                    <th>{t('ai.learning.table.priority')}</th>
                    <th>{t('ai.learning.table.created')}</th>
                    <th>{t('ai.learning.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(row => (
                    <tr key={row.id}>
                      <td>{row.question.slice(0, 80)}</td>
                      <td>{row.detectedIntent ?? '—'}</td>
                      <td>{Math.round(row.confidenceScore * 100)}%</td>
                      <td>{row.timesAsked}</td>
                      <td>{row.priority}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td className="ail-actions">
                        <button type="button" className="ail-btn ail-btn--primary" onClick={() => setReviewItem(row)}>{t('ai.learning.actions.review')}</button>
                        <button type="button" className="ail-btn" onClick={() => aiLearningApi.ignoreItem(row.id)}>{t('ai.learning.actions.ignore')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'suggested' && (
        <>
          <div className="ail-toolbar-row">
            <button
              type="button"
              className="ail-btn"
              onClick={() =>
                downloadCsv(
                  'suggested-answers.csv',
                  [
                    t('ai.learning.table.question'),
                    t('ai.learning.table.draftAnswer'),
                    t('ai.learning.table.confidence'),
                  ],
                  suggested.map(r => [
                    r.question,
                    r.aiDraftAnswer ?? '',
                    `${Math.round(r.confidenceScore * 100)}%`,
                  ]),
                )
              }
            >
              {t('ai.learning.exportCsv')}
            </button>
          </div>
          <div className="ail-table-wrap">
            <table className="ail-table">
              <thead>
                <tr>
                  <th>{t('ai.learning.table.question')}</th>
                  <th>{t('ai.learning.table.draftAnswer')}</th>
                  <th>{t('ai.learning.table.confidence')}</th>
                  <th>{t('ai.learning.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {suggested.map(row => (
                  <tr key={row.id}>
                    <td>{row.question.slice(0, 60)}</td>
                    <td>{(row.aiDraftAnswer ?? '').slice(0, 60)}</td>
                    <td>{Math.round(row.confidenceScore * 100)}%</td>
                    <td className="ail-actions">
                      <button type="button" className="ail-btn" onClick={() => setEditSuggested(row)}>{t('ai.learning.actions.editApprove')}</button>
                      <button type="button" className="ail-btn" onClick={() => aiLearningApi.rejectItem(row.id)}>{t('ai.learning.actions.reject')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'approved' && (
        <>
          <div className="ail-toolbar-row">
            <button
              type="button"
              className="ail-btn"
              onClick={() =>
                downloadCsv(
                  'approved-knowledge.csv',
                  [
                    t('ai.learning.table.pattern'),
                    t('ai.learning.table.answer'),
                    t('ai.learning.table.file'),
                    t('ai.learning.table.used'),
                    t('ai.learning.table.success'),
                    t('ai.learning.table.status'),
                  ],
                  knowledge.map(r => [
                    r.questionPattern,
                    r.approvedAnswer,
                    r.targetFile ?? '',
                    String(r.timesUsed),
                    r.successRate != null ? `${Math.round(r.successRate * 100)}%` : '',
                    r.status,
                  ]),
                )
              }
            >
              {t('ai.learning.exportCsv')}
            </button>
          </div>
          <div className="ail-table-wrap">
            <table className="ail-table">
              <thead>
                <tr>
                  <th>{t('ai.learning.table.pattern')}</th>
                  <th>{t('ai.learning.table.answer')}</th>
                  <th>{t('ai.learning.table.file')}</th>
                  <th>{t('ai.learning.table.used')}</th>
                  <th>{t('ai.learning.table.success')}</th>
                  <th>{t('ai.learning.table.status')}</th>
                  <th>{t('ai.learning.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {knowledge.map(row => (
                  <tr key={row.id}>
                    <td>{row.questionPattern.slice(0, 50)}</td>
                    <td>{row.approvedAnswer.slice(0, 50)}</td>
                    <td>{row.targetFile}</td>
                    <td>{row.timesUsed}</td>
                    <td>{row.successRate != null ? `${Math.round(row.successRate * 100)}%` : '—'}</td>
                    <td>{row.status}</td>
                    <td><button type="button" className="ail-btn" onClick={() => setEditKnowledge(row)}>{t('ai.learning.actions.edit')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'demand' && (
        <>
          <ProductDemandFilterBar filters={demandFilters} onChange={setDemandFilters} />
          <div className="ail-toolbar-row">
            <button
              type="button"
              className="ail-btn"
              onClick={() =>
                downloadCsv(
                  'product-demand.csv',
                  ['Product', 'Requests', 'Installment', 'Discount', 'OOS', 'Trend'],
                  demandItems.map(r => [
                    r.detectedProductName ?? r.productId ?? '',
                    String(r.requestCount),
                    String(r.installmentRequests),
                    String(r.discountRequests),
                    String(r.outOfStockCount),
                    r.trend,
                  ]),
                )
              }
            >
              {t('ai.learning.exportCsv')}
            </button>
          </div>
          <div className="ail-table-wrap">
          <table className="ail-table">
            <thead>
              <tr>
                <th>{t('ai.learning.table.product')}</th>
                <th>{t('ai.learning.table.requests')}</th>
                <th>{t('ai.learning.table.installment')}</th>
                <th>{t('ai.learning.table.discount')}</th>
                <th>{t('ai.learning.table.oos')}</th>
                <th>{t('ai.learning.table.trend')}</th>
                <th>{t('ai.learning.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {demandItems.map(row => (
                <tr key={row.id}>
                  <td>{row.detectedProductName ?? row.productId ?? '—'}</td>
                  <td>{row.requestCount}</td>
                  <td>{row.installmentRequests}</td>
                  <td>{row.discountRequests}</td>
                  <td>{row.outOfStockCount}</td>
                  <td>{row.trend}</td>
                  <td><button type="button" className="ail-btn" onClick={() => setDemandDetail(row.id)}>{t('ai.learning.actions.details')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {tab === 'missing' && (
        <>
          <div className="ail-toolbar-row">
            <button type="button" className="ail-btn ail-btn--primary" onClick={() => setCreateRequestFor('new')}>
              {t('ai.learning.actions.newProductRequest')}
            </button>
            <button
              type="button"
              className="ail-btn"
              onClick={() =>
                downloadCsv(
                  'missing-products.csv',
                  [
                    t('ai.learning.table.rawName'),
                    t('ai.learning.table.times'),
                    t('ai.learning.table.customers'),
                    t('ai.learning.table.status'),
                  ],
                  missing.map(r => [r.rawProductName, String(r.timesAsked), String(r.uniqueCustomers), r.status]),
                )
              }
            >
              {t('ai.learning.exportCsv')}
            </button>
          </div>
        <div className="ail-table-wrap">
          <table className="ail-table">
            <thead>
              <tr>
                <th>{t('ai.learning.table.rawName')}</th>
                <th>{t('ai.learning.table.times')}</th>
                <th>{t('ai.learning.table.customers')}</th>
                <th>{t('ai.learning.table.status')}</th>
                <th>{t('ai.learning.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {missing.map(row => (
                <tr key={row.id}>
                  <td>{row.rawProductName}</td>
                  <td>{row.timesAsked}</td>
                  <td>{row.uniqueCustomers}</td>
                  <td>{row.status}</td>
                  <td className="ail-actions">
                    <button type="button" className="ail-btn" onClick={() => setMapMissing(row.id)}>{t('ai.learning.actions.map')}</button>
                    <button type="button" className="ail-btn" onClick={() => setCreateRequestFor(row)}>{t('ai.learning.actions.request')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {tab === 'requests' && (
        <>
          <div className="ail-toolbar-row">
            <label className="ail-muted">
              {t('ai.learning.table.status')}
              <select
                className="ail-filter-select"
                value={requestStatusFilter}
                onChange={e => setRequestStatusFilter(e.target.value as CatalogRequestStatusFilter)}
              >
                {catalogRequestStatusFilters.map(id => (
                  <option key={id} value={id}>{t(`ai.learning.requestFilters.${id}`)}</option>
                ))}
              </select>
            </label>
            <button type="button" className="ail-btn ail-btn--primary" onClick={() => setCreateRequestFor('new')}>
              {t('ai.learning.actions.newProductRequest')}
            </button>
            <button
              type="button"
              className="ail-btn"
              onClick={() =>
                downloadCsv(
                  'product-requests.csv',
                  [
                    t('ai.learning.table.product'),
                    t('ai.learning.filters.category'),
                    t('ai.learning.filters.brand'),
                    t('ai.learning.table.customers'),
                    t('ai.learning.table.priority'),
                    t('ai.learning.table.linkedProduct'),
                    t('ai.learning.table.status'),
                    t('ai.learning.table.date'),
                  ],
                  catalogRequests.map(r => [
                    r.productName,
                    r.category ?? '',
                    r.brand ?? '',
                    String(r.customerCount),
                    r.priority,
                    r.linkedProductName ?? '',
                    r.status,
                    formatDate(r.createdAt),
                  ]),
                )
              }
            >
              {t('ai.learning.exportCsv')}
            </button>
          </div>
          <div className="ail-table-wrap">
            <table className="ail-table">
              <thead>
                <tr>
                  <th>{t('ai.learning.table.product')}</th>
                  <th>{t('ai.learning.filters.category')}</th>
                  <th>{t('ai.learning.filters.brand')}</th>
                  <th>{t('ai.learning.table.customers')}</th>
                  <th>{t('ai.learning.table.priority')}</th>
                  <th>{t('ai.learning.table.linkedProduct')}</th>
                  <th>{t('ai.learning.table.status')}</th>
                  <th>{t('ai.learning.table.date')}</th>
                  <th>{t('ai.learning.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {catalogRequests.map(row => (
                  <tr key={row.id}>
                    <td>{row.productName}</td>
                    <td>{row.category ?? '—'}</td>
                    <td>{row.brand ?? '—'}</td>
                    <td>{row.customerCount}</td>
                    <td>{row.priority}</td>
                    <td>{row.linkedProductName ?? '—'}</td>
                    <td>{formatCatalogRequestStatus(t, row.status)}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td className="ail-actions">
                      <button type="button" className="ail-btn" onClick={() => setCatalogRequestDetail(row)}>
                        {t('ai.learning.actions.details')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'recommendations' && (
        <div>
          {recommendations.map(rec => (
            <div key={rec.id} className="ail-rec-card">
              <h4>{rec.title}</h4>
              <p>{rec.reason}</p>
              <p className="ail-muted">{rec.dataProof}</p>
              <button type="button" className="ail-btn" onClick={() => setRecAction(rec.id)}>{t('ai.learning.actions.takeAction')}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <>
          <div className="ail-toolbar-row">
            <button
              type="button"
              className="ail-btn"
              onClick={() =>
                downloadCsv(
                  'learning-history.csv',
                  [
                    t('ai.learning.table.date'),
                    t('ai.learning.table.question'),
                    t('ai.learning.table.answer'),
                    t('ai.learning.table.by'),
                    t('ai.learning.table.outcome'),
                  ],
                  history.map(r => [
                    formatDate(r.approvedAt),
                    r.question,
                    r.adminFinalAnswer ?? '',
                    r.approvedBy ?? '',
                    formatLearningOutcome(t, r.outcome),
                  ]),
                )
              }
            >
              {t('ai.learning.exportCsv')}
            </button>
          </div>
        <div className="ail-table-wrap">
          <table className="ail-table">
            <thead>
              <tr>
                <th>{t('ai.learning.table.date')}</th>
                <th>{t('ai.learning.table.question')}</th>
                <th>{t('ai.learning.table.answer')}</th>
                <th>{t('ai.learning.table.by')}</th>
                <th>{t('ai.learning.table.outcome')}</th>
                <th>{t('ai.learning.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map(row => (
                <tr key={row.id}>
                  <td>{formatDate(row.approvedAt)}</td>
                  <td>{row.question.slice(0, 50)}</td>
                  <td>{(row.adminFinalAnswer ?? '').slice(0, 50)}</td>
                  <td>{row.approvedBy ?? '—'}</td>
                  <td>{formatLearningOutcome(t, row.outcome)}</td>
                  <td><button type="button" className="ail-btn" onClick={() => setHistoryItem(row)}>{t('ai.learning.actions.view')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {tab === 'settings' && settings && (
        <div>
          <p>{t('ai.learning.settingsSummary.highConfidence', { pct: Math.round(settings.highConfidenceThreshold * 100) })}</p>
          <p>{t('ai.learning.settingsSummary.mediumConfidence', { pct: Math.round(settings.mediumConfidenceThreshold * 100) })}</p>
          {settings.trainingCenterEnabled !== false ? (
            <p>
              {t('ai.training.settingsSummary.matchThreshold', {
                defaultValue: 'Training inbox match threshold: {{pct}}%',
                pct: Math.round((settings.trainingKnowledgeMatchThreshold ?? 0.65) * 100),
              })}
            </p>
          ) : null}
          <p>{t('ai.learning.settingsSummary.trackOutcome', { value: settings.trackCustomerOutcome ? t('common.yes', 'Yes') : t('common.no', 'No') })}</p>
          <p className="ail-muted">{settings.defaultUnknownReply}</p>
          <button type="button" className="ail-btn ail-btn--primary" onClick={() => setSettingsOpen(true)}>{t('ai.learning.actions.editLearningSettings')}</button>
        </div>
      )}

      {reviewItem && <ReviewUnknownQuestionModal item={reviewItem} onClose={() => setReviewItem(null)} />}
      {editSuggested && <EditSuggestedAnswerModal item={editSuggested} onClose={() => setEditSuggested(null)} />}
      {editKnowledge && <EditApprovedKnowledgeModal row={editKnowledge} onClose={() => setEditKnowledge(null)} />}
      {demandDetailRow && <ProductDemandDetailsModal row={demandDetailRow} onClose={() => setDemandDetail(null)} />}
      {missingRow && (
        <MapMissingProductModal
          row={missingRow}
          onClose={() => setMapMissing(null)}
          onCreateRequest={() => {
            setCreateRequestFor(missingRow);
            setMapMissing(null);
          }}
        />
      )}
      {createRequestFor && (
        <CreateProductRequestModal
          initial={createRequestFor === 'new' ? undefined : createRequestFor}
          onClose={() => setCreateRequestFor(null)}
        />
      )}
      {catalogRequestDetail && (
        <ProductCatalogRequestModal
          request={catalogRequestDetail}
          onClose={() => setCatalogRequestDetail(null)}
        />
      )}
      {recRow && <RecommendationActionModal rec={recRow} onClose={() => setRecAction(null)} />}
      {historyItem && <LearningHistoryDetailsModal item={historyItem} onClose={() => setHistoryItem(null)} />}
      {settingsOpen && settings && <LearningSettingsModal settings={settings} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
