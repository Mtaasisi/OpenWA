import { describe, expect, it } from 'vitest';
import {
  aggregateProductDemand,
  escalationDetailToProductInterest,
  isUnusableProductInterestName,
  mergeHotLeadsWithAiEscalations,
  stockingReminderAccountLabel,
  stockingReminderCustomerLabel,
} from './dashboard-metrics';
import type { PipelineCard } from '../services/api';

function card(productInterest: string | null): PipelineCard {
  return {
    id: '1',
    sessionId: 'sess-1',
    chatId: '255712345678@c.us',
    customerName: null,
    customerPhone: null,
    customerHandle: null,
    source: 'whatsapp',
    channel: 'whatsapp',
    stage: 'new_lead',
    productInterest,
    priority: 'normal',
    lastCustomerMessageAt: null,
    lastStaffMessageAt: null,
    nextFollowupAt: null,
    nextAction: null,
    assignedStaffId: null,
    assignedStaffName: null,
    isManual: false,
    linkedSaleId: null,
    responseTimeSeconds: null,
  };
}

describe('product demand sanitization', () => {
  it('rejects group lead prefixes and raw ids', () => {
    expect(isUnusableProductInterestName('Group lead: Bei ya laptop?')).toBe(true);
    expect(isUnusableProductInterestName('120363123456789012@g.us')).toBe(true);
    expect(isUnusableProductInterestName('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    expect(isUnusableProductInterestName('iPhone 15')).toBe(false);
  });

  it('does not map group lead escalations to product interest', () => {
    expect(escalationDetailToProductInterest('Bei ya laptop?', 'group_lead')).toBeNull();
    expect(escalationDetailToProductInterest('Group lead: laptop', 'other')).toBeNull();
    expect(escalationDetailToProductInterest('MacBook Air', 'other')).toBe('MacBook Air');
  });

  it('prefers API-resolved names over thread display lookup', () => {
    const { leads } = mergeHotLeadsWithAiEscalations(
      [],
      [
        {
          id: 'esc-2',
          sessionId: 'sess-1',
          chatId: '255712345678@c.us',
          reason: 'complaint',
          detail: 'Angry about delivery',
          createdAt: new Date().toISOString(),
          customerName: 'Jane Doe',
          customerPhone: '255712345678',
          sessionName: 'Sales Line',
        },
      ],
      {
        threadDisplay: {
          customerLabel: () => 'Fallback name',
          accountLabel: () => 'Fallback account',
        },
      },
    );
    expect(leads[0]).toMatchObject({
      customerName: 'Jane Doe',
      channel: 'Sales Line',
    });
  });

  it('merges group lead escalations without product interest pollution', () => {
    const { leads } = mergeHotLeadsWithAiEscalations(
      [],
      [
        {
          id: 'esc-1',
          sessionId: 'sess-1',
          chatId: '120363123456789012@g.us',
          reason: 'group_lead',
          detail: 'Bei ya laptop?',
          createdAt: new Date().toISOString(),
        },
      ],
      {
        threadDisplay: {
          customerLabel: () => 'Buyers group (group)',
          accountLabel: () => 'Sales WhatsApp',
        },
      },
    );
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      stage: 'group_lead',
      customerName: 'Buyers group (group)',
      channel: 'Sales WhatsApp',
      productInterest: null,
      nextAction: 'Bei ya laptop?',
    });
  });

  it('labels stocking reminders with API thread fields when product name is missing', () => {
    expect(
      stockingReminderCustomerLabel({
        id: 'stock-1',
        sessionId: 'sess-1',
        chatId: '255712345678@c.us',
        productName: null,
        customerName: 'Jane Doe',
        sessionName: 'Sales Line',
        createdAt: new Date().toISOString(),
      }),
    ).toBe('Jane Doe');
    expect(
      stockingReminderAccountLabel({ sessionId: 'sess-1', sessionName: 'Sales Line' }),
    ).toBe('Sales Line');
  });

  it('aggregates only clean product names', () => {
    const rows = aggregateProductDemand(
      [
        card('Group lead: laptop inquiry'),
        card('120363123456789012@g.us'),
        card('Samsung A54'),
        card('Samsung A54'),
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Samsung A54', requests: 2 });
  });
});
