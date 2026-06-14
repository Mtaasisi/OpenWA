import { AiProvider } from './ai.enums';

export const PROVIDER_BASE_URLS: Partial<Record<AiProvider, string>> = {
  GROQ: 'https://api.groq.com/openai/v1',
  DEEPSEEK: 'https://api.deepseek.com/v1',
  XAI: 'https://api.x.ai/v1',
  MISTRAL: 'https://api.mistral.ai/v1',
  TOGETHER: 'https://api.together.xyz/v1',
  MOONSHOT: 'https://api.moonshot.ai/v1',
  GLM: 'https://open.bigmodel.cn/api/paas/v4',
  QWEN: 'https://dashscope-intl.aliyuncs.com/v1',
  STEPFUN: 'https://api.stepfun.com/v1',
  OPENROUTER: 'https://openrouter.ai/api/v1',
};

export const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  GEMINI: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
  ],
  OPENAI: [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4o',
    'gpt-4o-mini',
    'o4-mini',
    'o3',
  ],
  ANTHROPIC: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-haiku-4-5-20251001',
  ],
  GROQ: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  DEEPSEEK: ['deepseek-chat', 'deepseek-reasoner'],
  XAI: ['grok-4', 'grok-3', 'grok-3-mini'],
  MISTRAL: [
    'mistral-large-latest',
    'mistral-small-latest',
    'codestral-latest',
  ],
  TOGETHER: [
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'deepseek-ai/DeepSeek-V3.1',
  ],
  MOONSHOT: ['kimi-k2.5', 'kimi-k2-turbo'],
  GLM: ['glm-4.7', 'glm-4.5-flash'],
  QWEN: ['qwen-max', 'qwen-plus'],
  STEPFUN: ['step-2-16k', 'step-1-32k'],
  OLLAMA: ['llama3.3', 'llama3.1', 'mistral', 'phi4'],
  OPENROUTER: [
    'openai/gpt-4o-mini',
    'anthropic/claude-sonnet-4-6',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-chat',
  ],
  CUSTOM: ['custom'],
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  GEMINI: 'Google Gemini',
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic Claude',
  GROQ: 'Groq',
  DEEPSEEK: 'DeepSeek',
  XAI: 'xAI (Grok)',
  MISTRAL: 'Mistral',
  TOGETHER: 'Together AI',
  MOONSHOT: 'Moonshot (Kimi)',
  GLM: 'GLM (ZhipuAI)',
  QWEN: 'Qwen (Alibaba)',
  STEPFUN: 'StepFun',
  OLLAMA: 'Ollama (local)',
  OPENROUTER: 'OpenRouter',
  CUSTOM: 'Custom (OpenAI-compatible)',
};
