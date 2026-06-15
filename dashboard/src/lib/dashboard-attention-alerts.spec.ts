import { describe, expect, it } from 'vitest';
import { buildAttentionAlerts } from './dashboard-metrics';

const t = (key: string, opts?: Record<string, unknown>) => {
  if (opts?.count != null) return `${key}:${opts.count}`;
  return key;
};

describe('buildAttentionAlerts — demand campaigns', () => {
  it('adds draft campaign alert when draftCampaignsCount > 0', () => {
    const alerts = buildAttentionAlerts({
      unreplied: [],
      queueCounts: {},
      failedSends: 0,
      disconnectedSessions: [],
      qrSessions: [],
      unassignedHotLeads: [],
      aiPaused: [],
      demandAlerts: { draftCampaignsCount: 2 },
      t,
    });

    const draft = alerts.find(a => a.id === 'demand-campaigns-draft');
    expect(draft).toBeDefined();
    expect(draft?.actionTo).toBe('/campaigns');
    expect(draft?.title).toBe('dashboard.controlRoom.alerts.draftCampaignsTitle');
    expect(draft?.description).toBe('dashboard.controlRoom.alerts.draftCampaignsDesc:2');
  });

  it('skips draft campaign alert when count is zero', () => {
    const alerts = buildAttentionAlerts({
      unreplied: [],
      queueCounts: {},
      failedSends: 0,
      disconnectedSessions: [],
      qrSessions: [],
      unassignedHotLeads: [],
      aiPaused: [],
      demandAlerts: { draftCampaignsCount: 0, approvedCampaignsCount: 0 },
      t,
    });

    expect(alerts.find(a => a.id === 'demand-campaigns-draft')).toBeUndefined();
    expect(alerts.find(a => a.id === 'demand-campaigns-approved')).toBeUndefined();
  });

  it('adds approved campaign alert when approvedCampaignsCount > 0', () => {
    const alerts = buildAttentionAlerts({
      unreplied: [],
      queueCounts: {},
      failedSends: 0,
      disconnectedSessions: [],
      qrSessions: [],
      unassignedHotLeads: [],
      aiPaused: [],
      demandAlerts: { draftCampaignsCount: 0, approvedCampaignsCount: 2 },
      t,
    });

    const approved = alerts.find(a => a.id === 'demand-campaigns-approved');
    expect(approved).toBeDefined();
    expect(approved?.actionTo).toBe('/campaigns');
    expect(approved?.channel).toBe('whatsapp');
  });
});

describe('buildAttentionAlerts — profile enrichment', () => {
  it('adds lost-demand alert when lostWaiting > 0', () => {
    const alerts = buildAttentionAlerts({
      unreplied: [],
      queueCounts: {},
      failedSends: 0,
      disconnectedSessions: [],
      qrSessions: [],
      unassignedHotLeads: [],
      aiPaused: [],
      profileAlerts: { nameReview: 0, learningReview: 0, lostWaiting: 3 },
      t,
    });

    const alert = alerts.find(a => a.id === 'lost-demand-waiting');
    expect(alert).toBeDefined();
    expect(alert?.actionTo).toBe('/followups');
    expect(alert?.description).toBe('dashboard.controlRoom.alerts.lostDemandWaitingDesc:3');
  });

  it('adds name review alert when nameReview > 0', () => {
    const alerts = buildAttentionAlerts({
      unreplied: [],
      queueCounts: {},
      failedSends: 0,
      disconnectedSessions: [],
      qrSessions: [],
      unassignedHotLeads: [],
      aiPaused: [],
      profileAlerts: { nameReview: 2, learningReview: 0, lostWaiting: 0 },
      t,
    });

    expect(alerts.some(a => a.id === 'profile-name-review')).toBe(true);
  });
});
