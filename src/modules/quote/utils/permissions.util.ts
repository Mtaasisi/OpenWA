import { ApiKey, ApiKeyRole } from '../../auth/entities/api-key.entity';
import { QuotePermission } from '../quote.enums';

const ALL_PERMISSIONS = Object.values(QuotePermission);

const ROLE_DEFAULT_PERMISSIONS: Record<ApiKeyRole, QuotePermission[]> = {
  [ApiKeyRole.ADMIN]: ALL_PERMISSIONS,
  [ApiKeyRole.OPERATOR]: [
    QuotePermission.VIEW_QUOTES,
    QuotePermission.CREATE_CHAT_QUOTE,
    QuotePermission.SEND_CHAT_QUOTE,
    QuotePermission.CONVERT_QUOTE_TO_SALE,
  ],
  [ApiKeyRole.VIEWER]: [QuotePermission.VIEW_QUOTES],
};

export function getEffectiveQuotePermissions(apiKey: ApiKey): QuotePermission[] {
  const custom = apiKey.permissions;
  if (custom && custom.length > 0) {
    return custom.filter((p): p is QuotePermission =>
      ALL_PERMISSIONS.includes(p as QuotePermission),
    );
  }
  return ROLE_DEFAULT_PERMISSIONS[apiKey.role] ?? [];
}

export function hasQuotePermission(apiKey: ApiKey, permission: QuotePermission): boolean {
  return getEffectiveQuotePermissions(apiKey).includes(permission);
}
