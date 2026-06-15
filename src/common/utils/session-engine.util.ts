export const WHATSAPP_ENGINE_IDS = ['whatsapp-web.js', 'baileys'] as const;
export type WhatsAppEngineId = (typeof WHATSAPP_ENGINE_IDS)[number];

export function isSupportedEngineType(value: string): value is WhatsAppEngineId {
  return (WHATSAPP_ENGINE_IDS as readonly string[]).includes(value);
}

/** Per-session override, or global default when unset. */
export function resolveSessionEngineType(
  session: { engineType?: string | null },
  defaultEngineType: string,
): string {
  const override = session.engineType?.trim();
  if (override && isSupportedEngineType(override)) {
    return override;
  }
  return defaultEngineType?.trim() || 'whatsapp-web.js';
}
