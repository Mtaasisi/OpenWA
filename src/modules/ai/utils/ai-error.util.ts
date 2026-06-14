/** Turn raw provider HTTP bodies into short, user-facing messages. */
export function formatAiProviderError(status: number, bodyText: string): string {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
  }

  const errObj = parsed?.error;
  const nestedMsg =
    typeof errObj === 'object' && errObj !== null && 'message' in errObj
      ? String((errObj as { message?: unknown }).message ?? '')
      : '';
  const topMsg =
    typeof parsed?.message === 'string'
      ? parsed.message
      : typeof errObj === 'string'
        ? errObj
        : nestedMsg;

  if (status === 401) {
    return 'Invalid API key. Check your key in Settings → Integrations → AI and test the connection.';
  }
  if (status === 403) {
    return 'API access denied. Your key may lack permission for this model or endpoint.';
  }
  if (status === 404) {
    return 'Model or endpoint not found. Pick a different model in AI settings.';
  }
  if (status === 429) {
    return 'Rate limit exceeded. Wait a moment or add a fallback model in AI settings.';
  }
  if (status >= 500) {
    return 'The AI provider is temporarily unavailable. Try again or switch to a fallback model.';
  }

  if (topMsg) {
    const trimmed = topMsg.slice(0, 240);
    return trimmed.length < topMsg.length ? `${trimmed}…` : trimmed;
  }

  const snippet = bodyText.replace(/\s+/g, ' ').trim().slice(0, 180);
  return snippet ? `AI request failed (${status}): ${snippet}` : `AI request failed (${status})`;
}
