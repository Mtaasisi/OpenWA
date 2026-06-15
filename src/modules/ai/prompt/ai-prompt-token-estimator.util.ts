export interface PromptTokenBreakdown {
  rules_tokens: number;
  knowledge_tokens: number;
  history_tokens: number;
  tool_tokens: number;
  customer_message_tokens: number;
  crm_tokens: number;
  catalog_tokens: number;
  memory_tokens: number;
  total_estimated_input_tokens: number;
}

export function estimateTokensFromText(text: string): number {
  const t = text?.trim() ?? '';
  if (!t) return 0;
  return Math.ceil(t.length / 4);
}

export function estimateTokensFromBlocks(blocks: Record<string, string | undefined | null>): PromptTokenBreakdown {
  const rules_tokens = estimateTokensFromText(blocks.rules ?? '');
  const knowledge_tokens = estimateTokensFromText(blocks.knowledge ?? '');
  const history_tokens = estimateTokensFromText(blocks.history ?? '');
  const tool_tokens = estimateTokensFromText(blocks.tools ?? '');
  const customer_message_tokens = estimateTokensFromText(blocks.customerMessage ?? '');
  const crm_tokens = estimateTokensFromText(blocks.crm ?? '');
  const catalog_tokens = estimateTokensFromText(blocks.catalog ?? '');
  const memory_tokens = estimateTokensFromText(blocks.memory ?? '');

  const total_estimated_input_tokens =
    rules_tokens +
    knowledge_tokens +
    history_tokens +
    tool_tokens +
    customer_message_tokens +
    crm_tokens +
    catalog_tokens +
    memory_tokens;

  return {
    rules_tokens,
    knowledge_tokens,
    history_tokens,
    tool_tokens,
    customer_message_tokens,
    crm_tokens,
    catalog_tokens,
    memory_tokens,
    total_estimated_input_tokens,
  };
}

export type PromptBudgetWarning = 'simple_exceeded' | 'auto_reply_exceeded' | null;

export function resolvePromptBudgetWarning(
  breakdown: PromptTokenBreakdown,
  intent: string,
  limits: { simpleBudget: number; autoReplyBudget: number },
): PromptBudgetWarning {
  const simpleIntents = new Set(['greeting', 'presence']);
  const total = breakdown.total_estimated_input_tokens;
  if (simpleIntents.has(intent) && total > limits.simpleBudget) return 'simple_exceeded';
  if (total > limits.autoReplyBudget) return 'auto_reply_exceeded';
  return null;
}
