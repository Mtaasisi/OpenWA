import type { FollowupQueueItemView } from '../services/api';

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function downloadFollowupsCsv(
  rows: FollowupQueueItemView[],
  filename: string,
  sessionName: (sessionId: string) => string,
): void {
  const headers = [
    'Customer',
    'Phone',
    'Account',
    'Stage',
    'Reason',
    'Due',
    'Status',
    'Assigned staff',
    'Attempt',
    'Session ID',
    'Chat ID',
    'Conversation ID',
  ];

  const lines = [
    headers.join(','),
    ...rows.map(r =>
      [
        r.customerName,
        r.customerPhone,
        sessionName(r.sessionId),
        r.stage,
        r.recommendedAction ?? r.productInterest,
        r.dueAt,
        r.status,
        r.assignedStaffName,
        r.attemptNumber,
        r.sessionId,
        r.chatId,
        r.conversationId,
      ]
        .map(csvCell)
        .join(','),
    ),
  ];

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
