export interface StorageWarningLike {
  id: string;
  severity: 'high' | 'medium';
  message: string;
}

export function translateStorageWarning(
  warning: StorageWarningLike,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t(`systemStatus.storage.warnings.${warning.id}`, { defaultValue: warning.message });
}

export function storageAttentionTitle(
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t('dashboard.controlRoom.alerts.storageTitle', { defaultValue: 'Storage & backup' });
}

export function storageAttentionAction(
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t('dashboard.controlRoom.alerts.storageAction', {
    defaultValue: 'Open storage settings',
  });
}

export interface RestorePreviewMessageLike {
  id: string;
  params?: Record<string, string | number>;
}

export function translateRestorePreviewMessage(
  message: RestorePreviewMessageLike,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  return t(`settings.storageBackup.restore.messages.${message.id}`, {
    defaultValue: message.id,
    ...(message.params ?? {}),
  });
}
