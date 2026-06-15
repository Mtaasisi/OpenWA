import { useTranslation } from 'react-i18next';
import {
  ScheduleMessageModal,
  type ScheduleMessagePayload,
} from '../ScheduleMessageModal';
import type { FollowupQueueItemView } from '../../services/api';
import {
  customerInitials,
  followupCustomerLabel,
  followupPhoneDisplay,
} from './followup-utils';

export type FollowupScheduleMode = 'snooze' | 'autopilot';

export type FollowupSchedulePayload = ScheduleMessagePayload;

type Props = {
  open: boolean;
  item: FollowupQueueItemView | null;
  mode?: FollowupScheduleMode;
  onClose: () => void;
  onSchedule: (payload: FollowupSchedulePayload) => void;
  pending?: boolean;
};

export function FollowupScheduleModal({
  open,
  item,
  mode = 'snooze',
  onClose,
  onSchedule,
  pending = false,
}: Props) {
  const { t } = useTranslation();

  if (!item) return null;

  const title =
    mode === 'autopilot'
      ? t('followups.autopilot.scheduleTitle')
      : t('followups.scheduleModal.title');

  const recipient = {
    name: followupCustomerLabel(item, t),
    phone: followupPhoneDisplay(item.chatId, item.customerPhone, t),
    channel: t(`followups.sources.${item.source}`, { defaultValue: item.source.replace(/_/g, ' ') }),
    initials: customerInitials(item.customerName, item.customerPhone, item.chatId, t),
    lastActivityAt: item.lastCustomerMessageAt,
  };

  return (
    <ScheduleMessageModal
      open={open}
      recipient={recipient}
      title={title}
      initialDueAt={item.dueAt}
      defaultAiFollowUp={mode === 'autopilot'}
      onClose={onClose}
      onSchedule={onSchedule}
      pending={pending}
    />
  );
}
