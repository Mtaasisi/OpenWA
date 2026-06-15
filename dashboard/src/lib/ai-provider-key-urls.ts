import type { AiProviderId } from '../services/api';

/** Provider consoles where users create and copy API keys. */
export const AI_PROVIDER_KEY_URLS: Partial<Record<AiProviderId, string>> = {
  GEMINI: 'https://aistudio.google.com/apikey',
  OPENAI: 'https://platform.openai.com/api-keys',
  ANTHROPIC: 'https://console.anthropic.com/settings/keys',
  GROQ: 'https://console.groq.com/keys',
  DEEPSEEK: 'https://platform.deepseek.com/api_keys',
  XAI: 'https://console.x.ai/',
  MISTRAL: 'https://console.mistral.ai/api-keys/',
  TOGETHER: 'https://api.together.xyz/settings/api-keys',
  MOONSHOT: 'https://platform.moonshot.ai/console/api-keys',
  GLM: 'https://open.bigmodel.cn/usercenter/apikeys',
  QWEN: 'https://dashscope.console.aliyun.com/apiKey',
  STEPFUN: 'https://platform.stepfun.com/interface-key',
  OPENROUTER: 'https://openrouter.ai/keys',
};

export function getAiProviderKeyUrl(provider: AiProviderId): string | undefined {
  return AI_PROVIDER_KEY_URLS[provider];
}
