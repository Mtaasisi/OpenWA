import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { followupApi, type PipelineCard, type ConversationStage } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AskAiLink } from '../components/AskAiLink';
import { useRole } from '../hooks/useRole';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PipelineLeadDetail } from '../components/PipelineLeadDetail';
import { downloadCustomersCsv } from '../lib/customers-csv';
import { WorkspacePageHeader } from '../components/workspace';
import {
  CustomersMetricBento,
  CustomersFilterBar,
  CustomersTable,
} from '../components/customers';
import { CustomersPipelinePanel } from '../components/CustomersPipelinePanel';
import './Customers.css';

const PAGE_SIZE = 50;

const STAGES: ConversationStage[] = [
  'new_lead',
  'contacted',
  'needs_identified',
  'product_suggested',
  'price_sent',
  'negotiating',
  'waiting_customer_reply',
  'followup_needed',
  'payment_pending',
  'won',
  'lost',
  'dead_no_response',
];

type CustomersView = 'list' | 'pipeline';

export function Customers() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: CustomersView = searchParams.get('view') === 'pipeline' ? 'pipeline' : 'list';
  useDocumentTitle(t('customers.title'));
  const { canWrite } = useRole();

  const setView = (next: CustomersView) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'list') nextParams.delete('view');
    else nextParams.set('view', 'pipeline');
    setSearchParams(nextParams, { replace: true });
  };

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [stageFilter, setStageFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [unidentifiedOnly, setUnidentifiedOnly] = useState(false);
  const [resolvedOnly, setResolvedOnly] = useState(false);
  const [followUpDueOnly, setFollowUpDueOnly] = useState(false);
  const [multiThreadOnly, setMultiThreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'customers',
      debouncedSearch,
      stageFilter,
      staffFilter,
      sourceFilter,
      unidentifiedOnly,
      resolvedOnly,
      followUpDueOnly,
      multiThreadOnly,
      offset,
    ],
    queryFn: () =>
      followupApi.listCustomers({
        q: debouncedSearch || undefined,
        stage: stageFilter || undefined,
        staffId: staffFilter || undefined,
        source: sourceFilter || undefined,
        unidentifiedOnly,
        resolvedOnly,
        followUpDueOnly,
        multiThreadOnly,
        limit: PAGE_SIZE,
        offset,
      }),
    refetchInterval: 60_000,
    enabled: view === 'list',
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats;
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  const resetPage = () => setOffset(0);

  const resetFilters = () => {
    setStageFilter('');
    setStaffFilter('');
    setSourceFilter('');
    setUnidentifiedOnly(false);
    setResolvedOnly(false);
    setFollowUpDueOnly(false);
    setMultiThreadOnly(false);
    resetPage();
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const result = await followupApi.listCustomers({
        q: debouncedSearch || undefined,
        stage: stageFilter || undefined,
        staffId: staffFilter || undefined,
        source: sourceFilter || undefined,
        unidentifiedOnly,
        resolvedOnly,
        followUpDueOnly,
        multiThreadOnly,
        limit: 2000,
        offset: 0,
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadCustomersCsv(result.data, `customers-${date}.csv`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="followups-interakt customers-interakt">
      <WorkspacePageHeader
        title={t('customers.dashboardTitle')}
        searchPlaceholder={t('customers.searchPlaceholder')}
        search={search}
        onSearchChange={v => {
          setSearch(v);
          resetPage();
        }}
        onExport={() => void handleExportCsv()}
        exportDisabled={exporting || view !== 'list'}
        showNewTask={false}
        extraActions={
          <>
            <AskAiLink prompt={t('ai.prompts.customers')} />
            <button
              type="button"
              className="fu-btn fu-btn--ghost"
              onClick={() => void refetch()}
              disabled={isFetching || view !== 'list'}
              title={t('common.refresh')}
            >
              {isFetching ? <Loader2 className="spin" size={14} /> : null}
              {t('common.refresh')}
            </button>
          </>
        }
      />

      <div className="followups-interakt__scroll">
        {view === 'list' && (
          <CustomersMetricBento
            stats={stats}
            labels={{
              total: t('customers.stats.total'),
              unidentified: t('customers.stats.unidentified'),
              activeWeek: t('customers.stats.activeWeek'),
            }}
          />
        )}

        <div className="fu-view-row">
          <div className="fu-chips">
            <button
              type="button"
              className={['fu-chip', view === 'list' ? 'fu-chip--active' : ''].join(' ')}
              onClick={() => setView('list')}
            >
              {t('customers.viewAll')}
            </button>
            <button
              type="button"
              className={['fu-chip', view === 'pipeline' ? 'fu-chip--active' : ''].join(' ')}
              onClick={() => setView('pipeline')}
            >
              {t('customers.viewPipeline')}
            </button>
          </div>
        </div>

        {view === 'pipeline' ? (
          <CustomersPipelinePanel interakt />
        ) : (
          <>
            <CustomersFilterBar
              stage={stageFilter}
              source={sourceFilter}
              staffId={staffFilter}
              stages={STAGES}
              staff={staff}
              unidentifiedOnly={unidentifiedOnly}
              resolvedOnly={resolvedOnly}
              followUpDueOnly={followUpDueOnly}
              multiThreadOnly={multiThreadOnly}
              onStageChange={v => {
                setStageFilter(v);
                resetPage();
              }}
              onSourceChange={v => {
                setSourceFilter(v);
                resetPage();
              }}
              onStaffChange={v => {
                setStaffFilter(v);
                resetPage();
              }}
              onUnidentifiedChange={v => {
                setUnidentifiedOnly(v);
                resetPage();
              }}
              onResolvedChange={v => {
                setResolvedOnly(v);
                resetPage();
              }}
              onFollowUpDueChange={v => {
                setFollowUpDueOnly(v);
                resetPage();
              }}
              onMultiThreadChange={v => {
                setMultiThreadOnly(v);
                resetPage();
              }}
              onReset={resetFilters}
            />

            <CustomersTable
              rows={rows}
              isLoading={isLoading}
              onRowClick={setSelectedCard}
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={p => setOffset((p - 1) * PAGE_SIZE)}
            />
          </>
        )}
      </div>

      {selectedCard && (
        <PipelineLeadDetail
          card={selectedCard}
          canWrite={canWrite}
          showCustomerExtras
          onSelectConversation={setSelectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
