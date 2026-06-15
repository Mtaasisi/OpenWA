import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from '../../session/entities/session.entity';
import { resolveSessionEngineType } from '../../../common/utils/session-engine.util';
import {
  hasEngineAuth,
  sessionRequiresEngineRelink,
} from '../../../common/utils/engine-auth.util';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';

export type LinkPreflightSeverity = 'required' | 'recommended' | 'manual';

export interface LinkPreflightItem {
  id: string;
  ok: boolean;
  severity: LinkPreflightSeverity;
  detail?: string | null;
  /** Dashboard settings panel or session field to fix */
  fixTarget?: 'whatsapp-safety' | 'plugins' | 'session-proxy' | 'session-engine' | null;
  fixField?: string | null;
}

export interface LinkPreflightResult {
  sessionId: string | null;
  sessionName: string | null;
  ready: boolean;
  blockingOk: boolean;
  recommendedOk: boolean;
  completed: number;
  total: number;
  engineType: string;
  items: LinkPreflightItem[];
}

export interface LinkPreflightSummaryRow {
  sessionId: string;
  sessionName: string;
  ready: boolean;
  blockingOk: boolean;
  issueCount: number;
}

export interface LinkPreflightSummary {
  notReadyCount: number;
  sessions: LinkPreflightSummaryRow[];
}

function sessionNeedsLink(
  session: Session,
  engineType: string,
  sessionDataPath: string,
): boolean {
  const requiresRelink = sessionRequiresEngineRelink(
    engineType,
    sessionDataPath,
    session.name,
    session.phone,
  );
  if (requiresRelink) return true;
  if (!session.phone?.trim() || !hasEngineAuth(engineType, sessionDataPath, session.name)) {
    return true;
  }
  return (
    session.status === SessionStatus.DISCONNECTED ||
    session.status === SessionStatus.FAILED ||
    session.status === SessionStatus.CREATED ||
    session.status === SessionStatus.QR_READY
  );
}

function countAutomatedIssues(items: LinkPreflightItem[]): number {
  return items.filter(i => i.severity !== 'manual' && !i.ok).length;
}

@Injectable()
export class WhatsAppLinkPreflightService {
  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: WhatsAppSafetySettingsService,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
  ) {}

  async getPreflight(sessionId?: string): Promise<LinkPreflightResult> {
    const settings = await this.settingsService.getGlobal();
    const defaultEngine = this.configService.get<string>('engine.type', 'whatsapp-web.js');

    let session: Session | null = null;
    if (sessionId) {
      session = await this.sessionRepo.findOne({ where: { id: sessionId } });
      if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const engineType = session
      ? resolveSessionEngineType(session, defaultEngine)
      : defaultEngine;

    const items: LinkPreflightItem[] = [
      {
        id: 'safetyGuard',
        ok: settings.globalEnabled,
        severity: 'required',
        fixTarget: 'whatsapp-safety',
        fixField: 'globalEnabled',
      },
      {
        id: 'warmup',
        ok: settings.warmupEnabled,
        severity: 'required',
        fixTarget: 'whatsapp-safety',
        fixField: 'warmupEnabled',
      },
      {
        id: 'startupSafeMode',
        ok: settings.startupSafeModeEnabled,
        severity: 'required',
        fixTarget: 'whatsapp-safety',
        fixField: 'startupSafeModeEnabled',
      },
      {
        id: 'aiSafety',
        ok: !settings.aiAutoReplyEnabled || settings.aiSafetyEnabled,
        severity: 'required',
        detail: settings.aiAutoReplyEnabled ? undefined : 'AI auto-reply off',
        fixTarget: 'whatsapp-safety',
        fixField: 'aiSafetyEnabled',
      },
      {
        id: 'campaignsOff',
        ok: !settings.campaignsEnabled,
        severity: 'recommended',
        fixTarget: 'whatsapp-safety',
        fixField: 'campaignsEnabled',
      },
      {
        id: 'followupAutoOff',
        ok: !settings.followupAutoSendEnabled,
        severity: 'recommended',
        fixTarget: 'whatsapp-safety',
        fixField: 'followupAutoSendEnabled',
      },
      {
        id: 'outside24hTemplate',
        ok: settings.outside24hRequiresTemplate,
        severity: 'recommended',
        fixTarget: 'whatsapp-safety',
        fixField: 'outside24hRequiresTemplate',
      },
      {
        id: 'enginePreference',
        ok: engineType !== 'baileys',
        severity: 'recommended',
        detail: engineType,
        fixTarget: engineType === 'baileys' ? 'plugins' : null,
      },
      {
        id: 'dailySendLimit',
        ok: settings.maxOutboundPerDay <= 200,
        severity: 'recommended',
        detail: `${settings.maxOutboundPerDay}/day`,
        fixTarget: 'whatsapp-safety',
        fixField: 'maxOutboundPerDay',
      },
      {
        id: 'messageDelay',
        ok: settings.minDelayBetweenMessagesMs >= 3000,
        severity: 'recommended',
        detail: `${settings.minDelayBetweenMessagesMs}ms min`,
        fixTarget: 'whatsapp-safety',
        fixField: 'minDelayBetweenMessagesMs',
      },
      {
        id: 'reconnectStability',
        ok: this.configService.get<boolean>('session.reconnectInfinite', false) !== true,
        severity: 'recommended',
        detail: this.configService.get<boolean>('session.reconnectInfinite', false)
          ? 'SESSION_RECONNECT_INFINITE=true'
          : undefined,
      },
      {
        id: 'sessionProxy',
        ok: Boolean(session?.proxyUrl?.trim()),
        severity: 'recommended',
        fixTarget: session ? 'session-proxy' : null,
      },
      {
        id: 'lightStartupSync',
        ok: !settings.autoDownloadMediaOnStartup && !settings.fetchGroupInfoOnStartup,
        severity: 'recommended',
        fixTarget: 'whatsapp-safety',
      },
    ];

    const autoItems = items.filter(i => i.severity !== 'manual');
    const blockingOk = items.filter(i => i.severity === 'required').every(i => i.ok);
    const recommendedOk = items.filter(i => i.severity === 'recommended').every(i => i.ok);
    const completed = autoItems.filter(i => i.ok).length;

    return {
      sessionId: session?.id ?? null,
      sessionName: session?.name ?? null,
      ready: blockingOk && recommendedOk,
      blockingOk,
      recommendedOk,
      completed,
      total: autoItems.length,
      engineType,
      items,
    };
  }

  async getSummary(): Promise<LinkPreflightSummary> {
    const defaultEngine = this.configService.get<string>('engine.type', 'whatsapp-web.js');
    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    const allSessions = await this.sessionRepo.find({ order: { name: 'ASC' } });
    const targets = allSessions.filter(session =>
      sessionNeedsLink(
        session,
        resolveSessionEngineType(session, defaultEngine),
        sessionDataPath,
      ),
    );
    const sessions: LinkPreflightSummaryRow[] = [];

    for (const session of targets) {
      const preflight = await this.getPreflight(session.id);
      sessions.push({
        sessionId: session.id,
        sessionName: session.name,
        ready: preflight.ready,
        blockingOk: preflight.blockingOk,
        issueCount: countAutomatedIssues(preflight.items),
      });
    }

    return {
      notReadyCount: sessions.filter(row => !row.ready).length,
      sessions,
    };
  }
}
