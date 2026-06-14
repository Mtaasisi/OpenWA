/** Inbox thread AI handling state (customer WhatsApp agent). */
export enum InboxAiHandlingState {
  IDLE = 'idle',
  AI_HANDLING = 'ai_handling',
  WAITING_HUMAN = 'waiting_human',
  HUMAN_HANDLING = 'human_handling',
}
