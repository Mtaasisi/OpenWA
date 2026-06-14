/** Sent once when a customer opts out of AI auto-reply (override in AI settings). */
export const DEFAULT_AI_OPT_OUT_ACK_MESSAGE =
  'Thanks for your message. A team member will reply shortly — automated replies are off for this chat.';

export const DEFAULT_AI_OPT_OUT_ACK_SWAHILI =
  'Asante kwa ujumbe wako. Mtu atakujibu hivi karibuni — majibu ya kiotomatiki yamezimwa kwa mazungumzo haya.';

/** Pick acknowledgment text: custom setting > Swahili heuristic > English default. */
export function pickOptOutAckMessage(
  custom: string | null | undefined,
  customerMessage: string,
): string {
  if (custom?.trim()) return custom.trim();
  if (/(asante|simama|mtu halisi|hauntaki|sio bot)/i.test(customerMessage)) {
    return DEFAULT_AI_OPT_OUT_ACK_SWAHILI;
  }
  return DEFAULT_AI_OPT_OUT_ACK_MESSAGE;
}
