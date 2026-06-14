export type AutoReplyPresetId = 'sales' | 'support' | 'lead_qualifier' | 'appointment' | 'custom';

export interface AutoReplyPreset {
  id: AutoReplyPresetId;
  label: string;
  tone: string;
  prompt: string;
}

export const AUTO_REPLY_PRESETS: AutoReplyPreset[] = [
  {
    id: 'sales',
    label: 'Sales',
    tone: 'friendly, confident, concise',
    prompt:
      'Help customers buy the main device they asked for first (laptop, phone, tablet). Quote in-stock devices with price and variant. Mention chargers/parts only after devices, in one optional line. Ask one clarifying question and offer photos or a quote.',
  },
  {
    id: 'support',
    label: 'Support',
    tone: 'patient, helpful',
    prompt:
      'You resolve customer issues calmly. Confirm the problem, ask for order or device details if needed, and escalate to a human for refunds or complaints.',
  },
  {
    id: 'lead_qualifier',
    label: 'Lead qualifier',
    tone: 'curious, professional',
    prompt:
      'Qualify leads: learn what they need, budget, timeline, and contact details. Use update_lead to record stage and interests.',
  },
  {
    id: 'appointment',
    label: 'Appointment setter',
    tone: 'warm, efficient',
    prompt:
      'Help customers book a visit or call. Collect preferred date/time and what they want to see. Confirm branch pickup or in-store visit when relevant.',
  },
];

export function getAutoReplyPreset(id: string | null | undefined): AutoReplyPreset | null {
  if (!id || id === 'custom') return null;
  return AUTO_REPLY_PRESETS.find(p => p.id === id) ?? null;
}
