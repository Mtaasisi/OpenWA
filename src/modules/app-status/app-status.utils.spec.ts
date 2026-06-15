import { SessionStatus } from '../session/entities/session.entity';
import {
  computeAiStatus,
  computeDatabaseStatus,
  computeOverallStatus,
  computeQueueStatus,
  computeSyncStatus,
  computeWhatsAppStatus,
  computeWorkEfficiency,
} from './app-status.utils';

describe('app-status.utils', () => {
  describe('computeWhatsAppStatus', () => {
    it('returns neutral when no sessions', () => {
      const r = computeWhatsAppStatus([]);
      expect(r.status).toBe('neutral');
    });

    it('returns success when at least one ready and no QR', () => {
      const r = computeWhatsAppStatus([
        { id: '1', name: 'Main', status: SessionStatus.READY },
      ]);
      expect(r.status).toBe('success');
      expect(r.label).toBe('WA OK');
    });

    it('returns warning when ready but QR needed on another', () => {
      const r = computeWhatsAppStatus([
        { id: '1', name: 'Main', status: SessionStatus.READY },
        { id: '2', name: 'Alt', status: SessionStatus.QR_READY },
      ]);
      expect(r.status).toBe('warning');
    });

    it('returns error when none connected', () => {
      const r = computeWhatsAppStatus([
        { id: '1', name: 'Main', status: SessionStatus.DISCONNECTED },
      ]);
      expect(r.status).toBe('error');
    });
  });

  describe('computeAiStatus', () => {
    it('returns neutral when disabled', () => {
      expect(
        computeAiStatus({
          enabled: false,
          apiKeySet: false,
          autoReplyEnabled: false,
          autoReplyReady: false,
          masterEnabled: false,
          pendingLearning: 0,
          knowledgeIndexed: false,
          safetyEnabled: true,
        }).status,
      ).toBe('neutral');
    });

    it('returns error when provider missing', () => {
      expect(
        computeAiStatus({
          enabled: true,
          apiKeySet: false,
          autoReplyEnabled: false,
          autoReplyReady: false,
          masterEnabled: false,
          pendingLearning: 0,
          knowledgeIndexed: false,
          safetyEnabled: true,
        }).status,
      ).toBe('error');
    });

    it('returns success when healthy', () => {
      const r = computeAiStatus({
        enabled: true,
        apiKeySet: true,
        autoReplyEnabled: true,
        autoReplyReady: true,
        masterEnabled: true,
        pendingLearning: 0,
        knowledgeIndexed: true,
        safetyEnabled: true,
      });
      expect(r.status).toBe('success');
      expect(r.autoReply).toBe('on');
    });
  });

  describe('computeQueueStatus', () => {
    it('success when empty', () => {
      expect(computeQueueStatus({ pending: 0, delayed: 0, failed: 0 })).toBe('success');
    });
    it('warning when pending', () => {
      expect(computeQueueStatus({ pending: 2, delayed: 0, failed: 0 })).toBe('warning');
    });
    it('error when failed', () => {
      expect(computeQueueStatus({ pending: 0, delayed: 0, failed: 1 })).toBe('error');
    });
  });

  describe('computeDatabaseStatus', () => {
    it('offline on failure', () => {
      expect(computeDatabaseStatus({ ok: false, latencyMs: 0 }).status).toBe('error');
    });
    it('slow when latency high', () => {
      expect(computeDatabaseStatus({ ok: true, latencyMs: 1500 }).status).toBe('warning');
    });
    it('online when fast', () => {
      expect(computeDatabaseStatus({ ok: true, latencyMs: 50 }).status).toBe('success');
    });
  });

  describe('computeSyncStatus', () => {
    it('loading when syncing', () => {
      expect(computeSyncStatus({ syncing: true, unsynced: 0, failed: 0, lastSyncAt: null }).status).toBe(
        'loading',
      );
    });
    it('warning when unsynced', () => {
      expect(computeSyncStatus({ syncing: false, unsynced: 3, failed: 0, lastSyncAt: null }).status).toBe(
        'warning',
      );
    });
  });

  describe('computeOverallStatus', () => {
    it('error when database offline', () => {
      expect(
        computeOverallStatus({
          database: 'error',
          whatsapp: 'success',
          ai: 'success',
          queue: 'success',
          sync: 'success',
        }),
      ).toBe('error');
    });
  });

  describe('computeWorkEfficiency', () => {
    it('returns 100 when no pending work', () => {
      expect(computeWorkEfficiency(0, 0)).toBe(100);
    });
  });
});
