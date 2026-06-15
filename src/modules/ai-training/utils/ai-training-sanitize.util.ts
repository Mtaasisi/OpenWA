/** Mask phone numbers, emails, and long digit sequences for exports/storage. */
export function maskPrivateData(text: string): string {
  return text
    .replace(/\b\d{10,15}\b/g, '[PHONE]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/gi, '[EMAIL]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
}

/** Detect raw payment account numbers that should use DB tools instead of markdown. */
export function containsRawPaymentNumber(text: string): boolean {
  return /\b(paybill|till|account|namba ya malipo).*\d{5,}/i.test(text) || /\b\d{6,12}\b/.test(text);
}

/** Slug for AI_RULE_ID from intent or question. */
export function toRuleId(intentOrQuestion: string): string {
  return intentOrQuestion
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || 'learned_rule';
}

export interface ParsedCustomInstruction {
  intent: string;
  triggerPhrases: string[];
  action: string;
  responseTemplate: string;
  ruleId: string;
}

/** Heuristic parse of admin free-text instruction into structured rule. */
export function parseCustomInstruction(instruction: string, question?: string): ParsedCustomInstruction {
  const ruleId = toRuleId(question ?? instruction.slice(0, 40));
  const triggers: string[] = [];
  const lower = instruction.toLowerCase();

  if (/customer care|namba ya customer care|namba ya kupiga/.test(lower)) {
    triggers.push('namba ya customer care', 'customer care number', 'namba ya kupiga');
  }
  if (/branch|dar|arusha/.test(lower)) {
    triggers.push('branch', 'dar', 'arusha');
  }
  if (/malipo|payment/.test(lower)) {
    triggers.push('namba ya malipo', 'payment number', 'lipa');
  }
  if (triggers.length === 0 && question) {
    triggers.push(question.slice(0, 80));
  }

  return {
    intent: ruleId,
    triggerPhrases: triggers,
    action: instruction.trim(),
    responseTemplate: instruction.trim(),
    ruleId,
  };
}

export function buildStructuredRuleSection(input: {
  ruleId: string;
  title: string;
  source: string;
  approvedBy: string;
  body: string;
  triggers?: string[];
  exampleQuestion?: string;
  exampleAnswer?: string;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    '',
    `## Learned Rule: ${input.title}`,
    `AI_RULE_ID: ${input.ruleId}`,
    `Source: ${input.source}`,
    `Approved by: ${input.approvedBy}`,
    `Date: ${date}`,
    '',
    input.body.trim(),
  ];
  if (input.triggers?.length) {
    lines.push('', 'Trigger phrases:', ...input.triggers.map(t => `- ${t}`));
  }
  if (input.exampleQuestion && input.exampleAnswer) {
    lines.push('', 'Example:', `Customer: ${input.exampleQuestion}`, `AI: ${input.exampleAnswer}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function sectionExists(content: string, ruleId: string): boolean {
  return content.includes(`AI_RULE_ID: ${ruleId}`);
}
