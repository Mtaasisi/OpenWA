import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, User } from 'lucide-react';
import { followupApi } from '../services/api';
import { useToast } from './Toast';
import { MaterialSymbol } from './MaterialSymbol';

interface Props {
  sessionId: string;
  chatId: string;
  canWrite: boolean;
  onAssigned?: () => void;
  className?: string;
  variant?: 'interakt' | 'classic' | 'tactical';
}

export function InboxAssigneeSelect({
  sessionId,
  chatId,
  canWrite,
  onAssigned,
  className,
  variant = 'classic',
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: followupConv, isLoading: followupLoading } = useQuery({
    queryKey: ['followups', 'conv', sessionId, chatId],
    queryFn: () => followupApi.getConversation(sessionId, chatId),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
    staleTime: 60_000,
  });

  const assignStaff = useMutation({
    mutationFn: async (staffId: string | null) => {
      const conv = followupConv ?? (await followupApi.getConversation(sessionId, chatId));
      return followupApi.assignConversation(conv.id, staffId);
    },
    onSuccess: (_data, staffId) => {
      void queryClient.invalidateQueries({ queryKey: ['followups', 'conv', sessionId, chatId] });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
      toast.success(staffId ? t('pipeline.assigned') : t('pipeline.unassignedDone'));
      onAssigned?.();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const assignedStaffId = followupConv?.assignedStaffId ?? '';
  const canAssign = canWrite && !assignStaff.isPending && !followupLoading;
  const labelClass =
    variant === 'interakt'
      ? 'inbox-interakt-chat-header__assignee'
      : variant === 'tactical'
        ? 'tac-assignee'
        : 'inbox-assignee-select';
  const isInterakt = variant === 'interakt';

  return (
    <>
      <label className={className ?? labelClass} title={t('inbox.interakt.assignee')}>
        {isInterakt ? (
          <MaterialSymbol name="person" size={16} />
        ) : (
          <User size={16} strokeWidth={1.75} aria-hidden />
        )}
        <select
          className={
            variant === 'interakt'
              ? 'inbox-interakt-chat-header__assignee-select'
              : variant === 'tactical'
                ? 'tac-assignee__select'
                : 'inbox-assignee-select__input'
          }
          value={assignedStaffId}
          disabled={!canAssign}
          aria-label={t('inbox.interakt.assignee')}
          onChange={e => assignStaff.mutate(e.target.value || null)}
        >
          <option value="">{t('inbox.interakt.unassigned')}</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {isInterakt ? (
          <MaterialSymbol name="expand_more" size={12} className="inbox-interakt-chat-header__assignee-chevron" />
        ) : (
          <ChevronDown size={12} className="inbox-assignee-select__chevron" aria-hidden />
        )}
      </label>
      {assignStaff.isPending &&
        (isInterakt ? (
          <MaterialSymbol name="sync" size={14} spin className="inbox-interakt-chat-header__assignee-spinner" />
        ) : (
          <Loader2 className="animate-spin" size={14} aria-hidden />
        ))}
    </>
  );
}
