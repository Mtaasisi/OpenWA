import { useTranslation } from 'react-i18next';
import type { Session } from '../../services/api';
import type {
  FollowupSortKey,
  FollowupViewChip,
  FollowupMetrics,
} from './index';
import { FollowupMetricBento } from './FollowupMetricBento';
import { FollowupViewChips } from './FollowupViewChips';
import { FollowupFilterBar } from './FollowupFilterBar';
import { FollowupStitchToolbar } from './FollowupStitchToolbar';
import { FollowupStitchQueueList } from './FollowupStitchQueueList';
import { FollowupStitchActiveFilters } from './FollowupStitchActiveFilters';
import { LostDemandFollowupsPanel } from '../LostDemandFollowupsPanel';
import type { FollowupQueueItemView } from '../../services/api';

type StaffOption = { id: string; name: string };

type Props = {
  metrics: FollowupMetrics;
  doneGoal?: number;
  onMetricClick: (filter: import('../../services/api').FollowUpQueueFilter) => void;
  viewChip: FollowupViewChip;
  onViewChipChange: (chip: FollowupViewChip) => void;
  sortKey: FollowupSortKey;
  onSortChange: (key: FollowupSortKey) => void;
  autopilotCounts: Partial<Record<string, number>>;
  search: string;
  channelFilter: string;
  sessionFilter: string;
  staffFilter: string;
  stageFilter: string;
  sessions: Session[];
  staff: StaffOption[];
  stages: string[];
  onChannelChange: (value: string) => void;
  onSessionChange: (value: string) => void;
  onStaffChange: (value: string) => void;
  onStageChange: (value: string) => void;
  onClearSearch: () => void;
  onResetFilters: () => void;
  rows: FollowupQueueItemView[];
  sessionName: (sessionId: string) => string;
  page: number;
  onPageChange: (page: number) => void;
  selectedItem: FollowupQueueItemView | null;
  onRowClick: (item: FollowupQueueItemView) => void;
  onComplete: (item: FollowupQueueItemView) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  highlightConversationId?: string | null;
  canWrite?: boolean;
  exportDisabled?: boolean;
  onRefresh: () => void;
  onExport: () => void;
  onNewTask: () => void;
};

export function FollowupsStitchWorkspace({
  metrics,
  doneGoal,
  onMetricClick,
  viewChip,
  onViewChipChange,
  sortKey,
  onSortChange,
  autopilotCounts,
  search,
  channelFilter,
  sessionFilter,
  staffFilter,
  stageFilter,
  sessions,
  staff,
  stages,
  onChannelChange,
  onSessionChange,
  onStaffChange,
  onStageChange,
  onClearSearch,
  onResetFilters,
  rows,
  sessionName,
  page,
  onPageChange,
  selectedItem,
  onRowClick,
  onComplete,
  isLoading,
  isFetching,
  highlightConversationId,
  canWrite,
  exportDisabled,
  onRefresh,
  onExport,
  onNewTask,
}: Props) {
  const { t } = useTranslation();
  const staffName = (id: string) => staff.find(s => s.id === id)?.name ?? id;

  return (
    <div className="followups-stitch">
      <FollowupStitchToolbar
        isFetching={isFetching}
        exportDisabled={exportDisabled}
        showNewTask={canWrite}
        onRefresh={onRefresh}
        onExport={onExport}
        onNewTask={onNewTask}
      />

      <div className="followups-stitch__scroll">
        <div className="followups-stitch__inner">
          <section className="followups-stitch__metrics" aria-label="Follow-up metrics">
            <FollowupMetricBento
              metrics={metrics}
              doneGoal={doneGoal}
              onMetricClick={onMetricClick}
              hideEmpty
            />
          </section>

          <LostDemandFollowupsPanel variant="stitch" />

          <section className="followups-stitch__filters">
            <FollowupViewChips
              variant="stitch"
              activeChip={viewChip}
              onChipChange={onViewChipChange}
              sortKey={sortKey}
              onSortChange={onSortChange}
              autopilotCounts={autopilotCounts}
            />
            <FollowupFilterBar
              variant="stitch"
              channel={channelFilter}
              sessionId={sessionFilter}
              staffId={staffFilter}
              stage={stageFilter}
              sessions={sessions.map(s => ({ id: s.id, name: s.name ?? s.id }))}
              staff={staff}
              stages={stages}
              onChannelChange={onChannelChange}
              onSessionChange={onSessionChange}
              onStaffChange={onStaffChange}
              onStageChange={onStageChange}
              onReset={onResetFilters}
            />
            <FollowupStitchActiveFilters
              search={search}
              channel={channelFilter}
              sessionId={sessionFilter}
              staffId={staffFilter}
              stage={stageFilter}
              sessionName={sessionName}
              staffName={staffName}
              stageLabel={stage => t(`followups.stageLabels.${stage}`, { defaultValue: stage })}
              onClearSearch={onClearSearch}
              onClearChannel={() => onChannelChange('')}
              onClearSession={() => onSessionChange('')}
              onClearStaff={() => onStaffChange('')}
              onClearStage={() => onStageChange('')}
              onResetAll={onResetFilters}
            />
          </section>

          <section className="followups-stitch__queue">
            <FollowupStitchQueueList
              rows={rows}
              sessionName={sessionName}
              page={page}
              onPageChange={onPageChange}
              selectedId={selectedItem?.id ?? null}
              onRowClick={onRowClick}
              onComplete={onComplete}
              isLoading={isLoading}
              isFetching={isFetching}
              highlightConversationId={highlightConversationId}
              canWrite={canWrite}
              onNewTask={onNewTask}
              viewChip={viewChip}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
