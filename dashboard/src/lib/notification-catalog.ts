export type NotificationSectionId =
  | 'messages'
  | 'followups'
  | 'ai'
  | 'learning'
  | 'sessions'
  | 'system'
  | 'crm';

export type NotificationKindId =
  | 'message.direct'
  | 'message.group'
  | 'followup.due'
  | 'followup.escalated'
  | 'followup.kpi'
  | 'followup.autopilotApproval'
  | 'followup.autopilotPaused'
  | 'followup.autopilotFailed'
  | 'ai.escalated'
  | 'ai.optOut'
  | 'learning.pending'
  | 'learning.repeated'
  | 'learning.demandSpike'
  | 'learning.knowledgeReview'
  | 'session.qr'
  | 'session.disconnected'
  | 'system.serverDown'
  | 'system.databaseOffline'
  | 'system.whatsappDisconnected'
  | 'system.queueFailed'
  | 'system.syncFailed'
  | 'system.storageWarning'
  | 'crm.chatAssigned'
  | 'crm.quoteUpdate'
  | 'sms.failed'
  | 'sms.lowBalance';

export type NotificationPrefs = {
  enabled: boolean;
  showPreview: boolean;
  onlyWhenBackground: boolean;
  kinds: Partial<Record<NotificationKindId, boolean>>;
};

export type NotificationCatalogEntry = {
  id: NotificationKindId;
  section: NotificationSectionId;
  labelKey: string;
  descriptionKey: string;
  defaultEnabled: boolean;
  adminOnly?: boolean;
  silentDefault?: boolean;
};

export const NOTIFICATION_SECTIONS: Array<{
  id: NotificationSectionId;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    id: 'messages',
    titleKey: 'settings.notifications.sections.messages',
    descriptionKey: 'settings.notifications.sections.messagesDesc',
  },
  {
    id: 'followups',
    titleKey: 'settings.notifications.sections.followups',
    descriptionKey: 'settings.notifications.sections.followupsDesc',
  },
  {
    id: 'ai',
    titleKey: 'settings.notifications.sections.ai',
    descriptionKey: 'settings.notifications.sections.aiDesc',
  },
  {
    id: 'learning',
    titleKey: 'settings.notifications.sections.learning',
    descriptionKey: 'settings.notifications.sections.learningDesc',
  },
  {
    id: 'sessions',
    titleKey: 'settings.notifications.sections.sessions',
    descriptionKey: 'settings.notifications.sections.sessionsDesc',
  },
  {
    id: 'system',
    titleKey: 'settings.notifications.sections.system',
    descriptionKey: 'settings.notifications.sections.systemDesc',
  },
  {
    id: 'crm',
    titleKey: 'settings.notifications.sections.crm',
    descriptionKey: 'settings.notifications.sections.crmDesc',
  },
];

export const NOTIFICATION_CATALOG: NotificationCatalogEntry[] = [
  {
    id: 'message.direct',
    section: 'messages',
    labelKey: 'settings.notifications.kinds.messageDirect',
    descriptionKey: 'settings.notifications.kinds.messageDirectDesc',
    defaultEnabled: true,
  },
  {
    id: 'message.group',
    section: 'messages',
    labelKey: 'settings.notifications.kinds.messageGroup',
    descriptionKey: 'settings.notifications.kinds.messageGroupDesc',
    defaultEnabled: false,
  },
  {
    id: 'followup.due',
    section: 'followups',
    labelKey: 'settings.notifications.kinds.followupDue',
    descriptionKey: 'settings.notifications.kinds.followupDueDesc',
    defaultEnabled: true,
  },
  {
    id: 'followup.escalated',
    section: 'followups',
    labelKey: 'settings.notifications.kinds.followupEscalated',
    descriptionKey: 'settings.notifications.kinds.followupEscalatedDesc',
    defaultEnabled: true,
  },
  {
    id: 'followup.kpi',
    section: 'followups',
    labelKey: 'settings.notifications.kinds.followupKpi',
    descriptionKey: 'settings.notifications.kinds.followupKpiDesc',
    defaultEnabled: true,
  },
  {
    id: 'followup.autopilotApproval',
    section: 'followups',
    labelKey: 'settings.notifications.kinds.followupAutopilotApproval',
    descriptionKey: 'settings.notifications.kinds.followupAutopilotApprovalDesc',
    defaultEnabled: true,
  },
  {
    id: 'followup.autopilotPaused',
    section: 'followups',
    labelKey: 'settings.notifications.kinds.followupAutopilotPaused',
    descriptionKey: 'settings.notifications.kinds.followupAutopilotPausedDesc',
    defaultEnabled: true,
  },
  {
    id: 'followup.autopilotFailed',
    section: 'followups',
    labelKey: 'settings.notifications.kinds.followupAutopilotFailed',
    descriptionKey: 'settings.notifications.kinds.followupAutopilotFailedDesc',
    defaultEnabled: true,
  },
  {
    id: 'ai.escalated',
    section: 'ai',
    labelKey: 'settings.notifications.kinds.aiEscalated',
    descriptionKey: 'settings.notifications.kinds.aiEscalatedDesc',
    defaultEnabled: true,
  },
  {
    id: 'ai.optOut',
    section: 'ai',
    labelKey: 'settings.notifications.kinds.aiOptOut',
    descriptionKey: 'settings.notifications.kinds.aiOptOutDesc',
    defaultEnabled: true,
  },
  {
    id: 'learning.pending',
    section: 'learning',
    labelKey: 'settings.notifications.kinds.learningPending',
    descriptionKey: 'settings.notifications.kinds.learningPendingDesc',
    defaultEnabled: false,
    adminOnly: true,
    silentDefault: true,
  },
  {
    id: 'learning.repeated',
    section: 'learning',
    labelKey: 'settings.notifications.kinds.learningRepeated',
    descriptionKey: 'settings.notifications.kinds.learningRepeatedDesc',
    defaultEnabled: false,
    adminOnly: true,
    silentDefault: true,
  },
  {
    id: 'learning.demandSpike',
    section: 'learning',
    labelKey: 'settings.notifications.kinds.learningDemandSpike',
    descriptionKey: 'settings.notifications.kinds.learningDemandSpikeDesc',
    defaultEnabled: false,
    adminOnly: true,
    silentDefault: true,
  },
  {
    id: 'learning.knowledgeReview',
    section: 'learning',
    labelKey: 'settings.notifications.kinds.learningKnowledgeReview',
    descriptionKey: 'settings.notifications.kinds.learningKnowledgeReviewDesc',
    defaultEnabled: false,
    adminOnly: true,
    silentDefault: true,
  },
  {
    id: 'session.qr',
    section: 'sessions',
    labelKey: 'settings.notifications.kinds.sessionQr',
    descriptionKey: 'settings.notifications.kinds.sessionQrDesc',
    defaultEnabled: true,
  },
  {
    id: 'session.disconnected',
    section: 'sessions',
    labelKey: 'settings.notifications.kinds.sessionDisconnected',
    descriptionKey: 'settings.notifications.kinds.sessionDisconnectedDesc',
    defaultEnabled: true,
  },
  {
    id: 'system.serverDown',
    section: 'system',
    labelKey: 'settings.notifications.kinds.systemServerDown',
    descriptionKey: 'settings.notifications.kinds.systemServerDownDesc',
    defaultEnabled: true,
  },
  {
    id: 'system.databaseOffline',
    section: 'system',
    labelKey: 'settings.notifications.kinds.systemDatabaseOffline',
    descriptionKey: 'settings.notifications.kinds.systemDatabaseOfflineDesc',
    defaultEnabled: true,
  },
  {
    id: 'system.whatsappDisconnected',
    section: 'system',
    labelKey: 'settings.notifications.kinds.systemWhatsappDisconnected',
    descriptionKey: 'settings.notifications.kinds.systemWhatsappDisconnectedDesc',
    defaultEnabled: true,
  },
  {
    id: 'system.queueFailed',
    section: 'system',
    labelKey: 'settings.notifications.kinds.systemQueueFailed',
    descriptionKey: 'settings.notifications.kinds.systemQueueFailedDesc',
    defaultEnabled: true,
  },
  {
    id: 'system.syncFailed',
    section: 'system',
    labelKey: 'settings.notifications.kinds.systemSyncFailed',
    descriptionKey: 'settings.notifications.kinds.systemSyncFailedDesc',
    defaultEnabled: true,
  },
  {
    id: 'system.storageWarning',
    section: 'system',
    labelKey: 'settings.notifications.kinds.systemStorageWarning',
    descriptionKey: 'settings.notifications.kinds.systemStorageWarningDesc',
    defaultEnabled: true,
  },
  {
    id: 'crm.chatAssigned',
    section: 'crm',
    labelKey: 'settings.notifications.kinds.crmChatAssigned',
    descriptionKey: 'settings.notifications.kinds.crmChatAssignedDesc',
    defaultEnabled: true,
  },
  {
    id: 'crm.quoteUpdate',
    section: 'crm',
    labelKey: 'settings.notifications.kinds.crmQuoteUpdate',
    descriptionKey: 'settings.notifications.kinds.crmQuoteUpdateDesc',
    defaultEnabled: false,
  },
  {
    id: 'sms.failed',
    section: 'crm',
    labelKey: 'settings.notifications.kinds.smsFailed',
    descriptionKey: 'settings.notifications.kinds.smsFailedDesc',
    defaultEnabled: true,
    adminOnly: true,
  },
  {
    id: 'sms.lowBalance',
    section: 'crm',
    labelKey: 'settings.notifications.kinds.smsLowBalance',
    descriptionKey: 'settings.notifications.kinds.smsLowBalanceDesc',
    defaultEnabled: true,
    adminOnly: true,
  },
];

export const DEFAULT_NOTIFICATION_KINDS = Object.fromEntries(
  NOTIFICATION_CATALOG.map(entry => [entry.id, entry.defaultEnabled]),
) as Record<NotificationKindId, boolean>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  showPreview: true,
  onlyWhenBackground: true,
  kinds: { ...DEFAULT_NOTIFICATION_KINDS },
};

/** @deprecated Legacy desktop prefs shape — used only for migration */
export type LegacyDesktopNotificationPrefs = {
  enabled: boolean;
  messages: boolean;
  followups: boolean;
  ai: boolean;
  learning: boolean;
  system: boolean;
  includeGroups: boolean;
};

export function buildDefaultKinds(): Record<NotificationKindId, boolean> {
  return { ...DEFAULT_NOTIFICATION_KINDS };
}

export function isKindEnabled(
  prefs: NotificationPrefs,
  kind: NotificationKindId,
): boolean {
  if (!prefs.enabled) return false;
  return prefs.kinds[kind] ?? DEFAULT_NOTIFICATION_KINDS[kind] ?? false;
}

export function catalogForSection(section: NotificationSectionId): NotificationCatalogEntry[] {
  return NOTIFICATION_CATALOG.filter(e => e.section === section);
}

export function migrateLegacyNotificationPrefs(input: {
  inboxBrowserNotifications?: boolean;
  desktopNotifications?: Partial<LegacyDesktopNotificationPrefs>;
  notifications?: Partial<NotificationPrefs>;
}): NotificationPrefs {
  if (input.notifications && typeof input.notifications === 'object') {
    const n = input.notifications;
    return {
      enabled: n.enabled ?? DEFAULT_NOTIFICATION_PREFS.enabled,
      showPreview: n.showPreview ?? DEFAULT_NOTIFICATION_PREFS.showPreview,
      onlyWhenBackground: n.onlyWhenBackground ?? DEFAULT_NOTIFICATION_PREFS.onlyWhenBackground,
      kinds: {
        ...DEFAULT_NOTIFICATION_KINDS,
        ...(n.kinds ?? {}),
      },
    };
  }

  const legacy = input.desktopNotifications;
  const browserOn = input.inboxBrowserNotifications === true;
  const enabled = legacy?.enabled ?? (browserOn ? true : DEFAULT_NOTIFICATION_PREFS.enabled);

  const kinds = buildDefaultKinds();

  if (legacy) {
    const msgOn = legacy.messages !== false;
    kinds['message.direct'] = msgOn;
    kinds['message.group'] = msgOn && legacy.includeGroups === true;
    if (legacy.followups === false) {
      for (const id of NOTIFICATION_CATALOG.filter(e => e.section === 'followups').map(e => e.id)) {
        kinds[id] = false;
      }
    }
    if (legacy.ai === false) {
      kinds['ai.escalated'] = false;
      kinds['ai.optOut'] = false;
    }
    if (legacy.learning === false) {
      for (const id of NOTIFICATION_CATALOG.filter(e => e.section === 'learning').map(e => e.id)) {
        kinds[id] = false;
      }
    }
    if (legacy.system === false) {
      for (const id of NOTIFICATION_CATALOG.filter(e => e.section === 'system').map(e => e.id)) {
        kinds[id] = false;
      }
      kinds['session.qr'] = false;
      kinds['session.disconnected'] = false;
    }
  } else if (browserOn) {
    kinds['message.direct'] = true;
    kinds['followup.due'] = true;
    kinds['followup.escalated'] = true;
  } else if (!browserOn && !legacy) {
    return { ...DEFAULT_NOTIFICATION_PREFS, enabled: false };
  }

  return {
    enabled,
    showPreview: true,
    onlyWhenBackground: true,
    kinds,
  };
}

export function patchNotificationPrefs(
  prefs: NotificationPrefs,
  patch: Partial<NotificationPrefs>,
): NotificationPrefs {
  return {
    ...prefs,
    ...patch,
    kinds: patch.kinds ? { ...prefs.kinds, ...patch.kinds } : prefs.kinds,
  };
}

export function setSectionKindsEnabled(
  prefs: NotificationPrefs,
  section: NotificationSectionId,
  enabled: boolean,
): NotificationPrefs {
  const kinds = { ...prefs.kinds };
  for (const entry of catalogForSection(section)) {
    kinds[entry.id] = enabled;
  }
  return { ...prefs, kinds };
}
