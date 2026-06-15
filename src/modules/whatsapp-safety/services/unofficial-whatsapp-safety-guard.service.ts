/**
 * Alias for the central WhatsApp policy guard used before every outbound send.
 * @see WhatsAppPolicyGuardService
 */
export {
  WhatsAppPolicyGuardService as UnofficialWhatsAppSafetyGuardService,
  type GuardContext,
  type GuardDecision,
} from './whatsapp-policy-guard.service';
