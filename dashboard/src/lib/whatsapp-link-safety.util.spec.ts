import { describe, expect, it } from 'vitest';
import { channelsUrl } from './channel-routes';
import {
  buildLinkPreflightTogglePatch,
  buildLinkSafetyAutoFixPatch,
  countAutoFixableLinkSafetyIssues,
  countLinkPreflightIssues,
  getLinkPreflightToggleBinding,
  linkPreflightFixHref,
  readLinkPreflightToggleValue,
} from './whatsapp-link-safety.util';

describe('whatsapp-link-safety.util', () => {
  it('builds channels focus URL for session proxy fix', () => {
    const href = linkPreflightFixHref(
      { id: 'sessionProxy', ok: false, severity: 'recommended', fixTarget: 'session-proxy' },
      'sess-1',
    );
    expect(href).toBe(channelsUrl({ channel: 'whatsapp', sessionFocus: 'sess-1' }));
  });

  it('builds patch for failed auto-fixable checks', () => {
    const patch = buildLinkSafetyAutoFixPatch([
      { id: 'safetyGuard', ok: false, severity: 'required' },
      { id: 'campaignsOff', ok: false, severity: 'recommended' },
      { id: 'enginePreference', ok: false, severity: 'recommended' },
    ]);
    expect(patch).toEqual({ globalEnabled: true, campaignsEnabled: false });
    expect(countAutoFixableLinkSafetyIssues([
      { id: 'safetyGuard', ok: false, severity: 'required' },
      { id: 'enginePreference', ok: false, severity: 'recommended' },
    ])).toBe(1);
  });

  it('inverts toggle display for campaigns and follow-up off checks', () => {
    const settings = {
      id: '1',
      globalEnabled: true,
      warmupEnabled: true,
      maxOutboundPerHour: 1,
      maxOutboundPerDay: 1,
      maxAutoRepliesPerCustomerPerDay: 1,
      campaignsEnabled: true,
      followupAutoSendEnabled: false,
      aiAutoReplyEnabled: false,
      groupsAutoReplyEnabled: false,
      groupManagementEnabled: false,
      productBulkSendEnabled: false,
      statusPostsEnabled: false,
      whatsappCloudSyncEnabled: false,
      outside24hRequiresTemplate: true,
      startupSafeModeEnabled: true,
      minDelayBetweenMessagesMs: 1,
      maxDelayBetweenMessagesMs: 1,
      perContactCooldownMinutes: 1,
    };
    const campaigns = getLinkPreflightToggleBinding({
      id: 'campaignsOff',
      ok: false,
      severity: 'recommended',
      fixTarget: 'whatsapp-safety',
      fixField: 'campaignsEnabled',
    })!;
    expect(readLinkPreflightToggleValue(campaigns, settings)).toBe(false);
    expect(buildLinkPreflightTogglePatch(campaigns, true)).toEqual({ campaignsEnabled: false });

    const followup = getLinkPreflightToggleBinding({
      id: 'followupAutoOff',
      ok: true,
      severity: 'recommended',
      fixTarget: 'whatsapp-safety',
      fixField: 'followupAutoSendEnabled',
    })!;
    expect(readLinkPreflightToggleValue(followup, settings)).toBe(true);
    expect(buildLinkPreflightTogglePatch(followup, false)).toEqual({
      followupAutoSendEnabled: true,
    });
  });

  it('counts failing automated checks', () => {
    expect(
      countLinkPreflightIssues({
        sessionId: 's1',
        sessionName: 'a',
        ready: false,
        blockingOk: false,
        recommendedOk: false,
        completed: 8,
        total: 10,
        engineType: 'baileys',
        items: [
          { id: 'safetyGuard', ok: false, severity: 'required' },
          { id: 'warmup', ok: true, severity: 'required' },
          { id: 'enginePreference', ok: false, severity: 'recommended' },
          { id: 'dedicatedNumber', ok: false, severity: 'manual' },
        ],
      }),
    ).toBe(2);
  });
});
