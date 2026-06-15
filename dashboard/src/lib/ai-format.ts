/** Normalize API / chat errors for display in the UI. */
export function formatAiErrorMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return 'Something went wrong. Try again or check AI settings.';

  if (text.includes('AI is not configured') || text.includes('not enabled')) {
    return text;
  }

  const jsonMatch = text.match(/AI error: \d+ (\{.*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as { error?: { message?: string } };
      if (parsed.error?.message) return parsed.error.message;
    } catch {
      /* fall through */
    }
  }

  if (text.includes('Incorrect API key') || text.includes('invalid_api_key')) {
    return 'Invalid API key. Update it in Settings → Integrations → AI and test the connection.';
  }
  if (text.includes('401')) {
    return 'Authentication failed. Check your API key in AI settings.';
  }
  if (text.includes('429') || text.toLowerCase().includes('rate limit')) {
    return 'Rate limit hit. Wait a moment or add a fallback model in AI settings.';
  }

  const stripped = text
    .replace(/^AI (provider )?error:\s*/i, '')
    .replace(/^Bad Request Exception:\s*/i, '')
    .trim();

  return stripped.length > 320 ? `${stripped.slice(0, 320)}…` : stripped;
}

export function isLikelyAiError(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('api key') ||
    lower.includes('invalid') ||
    lower.includes('rate limit') ||
    lower.includes('authentication') ||
    lower.includes('not configured') ||
    lower.includes('not enabled') ||
    lower.startsWith('ai ')
  );
}
