import type { PipelineCard } from '../services/api';

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function downloadCustomersCsv(rows: PipelineCard[], filename: string): void {
  const headers = [
    'Name',
    'Phone',
    'Handle',
    'Stage',
    'Source',
    'Product interest',
    'Assigned staff',
    'Last customer message',
    'Last staff message',
    'Follow-up at',
    'Resolved',
    'INAUZWA ID',
    'Linked threads',
    'Session ID',
    'Chat ID',
  ];

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.customerName,
        r.customerPhone,
        r.customerHandle,
        r.stage,
        r.source,
        r.productInterest,
        r.assignedStaffName,
        r.lastCustomerMessageAt,
        r.lastStaffMessageAt,
        r.crmFollowUpAt ?? r.nextFollowupAt,
        r.crmResolved ? 'yes' : 'no',
        r.inauzwaCustomerId,
        r.linkedThreadCount ?? 1,
        r.sessionId,
        r.chatId,
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
