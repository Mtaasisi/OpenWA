import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import { aiApi, type AiProviderId, type AiFallbackEntry } from '../../services/api';
import { formatAiErrorMessage } from '../../lib/ai-format';
import { getAiProviderKeyUrl } from '../../lib/ai-provider-key-urls';
import { useToast } from '../Toast';
import { MaterialSymbol } from '../MaterialSymbol';
import { AiSetupChecklist } from './AiSetupChecklist';
import { AiCostSettingsSection } from './AiCostSettingsSection';
import { SettingsIntegrationShell } from './SettingsIntegrationShell';
import { SettingsAskAiButton } from './SettingsAskAiButton';
import { canAccessApiDocs } from '../../lib/can-access-api-docs';
import { useRole } from '../../hooks/useRole';
import { useAiCostPermissions } from '../../hooks/useAiCostPermissions';
import { settingsPanelHref } from './settings-nav-registry';
import { InteraktCheckOption } from './SettingsInteraktPrimitives';

const AUTO_REPLY_CONTEXT_MESSAGES_DEFAULT = 3;
const AUTO_REPLY_CONTEXT_MESSAGES_MIN = 3;
const AUTO_REPLY_CONTEXT_MESSAGES_MAX = 5;

function clampAutoReplyContextMessages(value: number): number {
  return Math.min(
    AUTO_REPLY_CONTEXT_MESSAGES_MAX,
    Math.max(AUTO_REPLY_CONTEXT_MESSAGES_MIN, value || AUTO_REPLY_CONTEXT_MESSAGES_DEFAULT),
  );
}
import { SettingsFormPage } from './shell/SettingsFormPrimitives';
import './AiIntegrationPanel.css';
import './AiSetupChecklist.css';

const AUTO_REPLY_WEEKDAYS: Array<{ value: number; labelKey: string }> = [
  { value: 0, labelKey: 'ai.settings.weekdaySun' },
  { value: 1, labelKey: 'ai.settings.weekdayMon' },
  { value: 2, labelKey: 'ai.settings.weekdayTue' },
  { value: 3, labelKey: 'ai.settings.weekdayWed' },
  { value: 4, labelKey: 'ai.settings.weekdayThu' },
  { value: 5, labelKey: 'ai.settings.weekdayFri' },
  { value: 6, labelKey: 'ai.settings.weekdaySat' },
];

const TIMEZONE_OPTIONS = [
  'Africa/Dar_es_Salaam',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'UTC',
];

const PROVIDERS: Array<{ value: AiProviderId; labelKey: string }> = [
  { value: 'GEMINI', labelKey: 'ai.providers.gemini' },
  { value: 'OPENAI', labelKey: 'ai.providers.openai' },
  { value: 'ANTHROPIC', labelKey: 'ai.providers.anthropic' },
  { value: 'GROQ', labelKey: 'ai.providers.groq' },
  { value: 'DEEPSEEK', labelKey: 'ai.providers.deepseek' },
  { value: 'XAI', labelKey: 'ai.providers.xai' },
  { value: 'MISTRAL', labelKey: 'ai.providers.mistral' },
  { value: 'TOGETHER', labelKey: 'ai.providers.together' },
  { value: 'MOONSHOT', labelKey: 'ai.providers.moonshot' },
  { value: 'GLM', labelKey: 'ai.providers.glm' },
  { value: 'QWEN', labelKey: 'ai.providers.qwen' },
  { value: 'STEPFUN', labelKey: 'ai.providers.stepfun' },
  { value: 'OLLAMA', labelKey: 'ai.providers.ollama' },
  { value: 'OPENROUTER', labelKey: 'ai.providers.openrouter' },
  { value: 'CUSTOM', labelKey: 'ai.providers.custom' },
];

const HUMAN_TIMING_DEFAULTS = {
  activeChatWaitMinMs: 500,
  activeChatWaitMaxMs: 1500,
  warmChatWaitMinMs: 1500,
  warmChatWaitMaxMs: 4000,
  coldChatWaitMinMs: 5000,
  coldChatWaitMaxMs: 9000,
  burstPauseMinMs: 4500,
  burstPauseMaxMs: 7500,
  maxBurstWaitMs: 30000,
  typingMinMs: 1200,
  typingMaxMs: 14000,
} as const;

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="ai-settings-switch-row"
      onClick={() => onChange(!checked)}
    >
      <span className="ai-settings-switch-row__label">{label}</span>
      <span className={`ai-settings-switch${checked ? ' is-on' : ''}`}>
        <span className="ai-settings-switch__knob" />
      </span>
    </button>
  );
}

function MsRangeField({
  label,
  hint,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  disabled,
  minLabel,
  maxLabel,
}: {
  label: string;
  hint: string;
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  disabled?: boolean;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div className="ai-settings-field">
      <label className="ai-settings-label">{label}</label>
      <p className="ai-settings-field-hint">{hint}</p>
      <div className="ai-settings-ms-range">
        <div className="ai-settings-ms-range__field">
          <span className="ai-settings-ms-range__sub">{minLabel}</span>
          <input
            type="number"
            min={0}
            max={120000}
            step={100}
            disabled={disabled}
            value={minValue}
            aria-label={`${label} ${minLabel}`}
            onChange={e => onMinChange(Number(e.target.value) || 0)}
          />
        </div>
        <div className="ai-settings-ms-range__field">
          <span className="ai-settings-ms-range__sub">{maxLabel}</span>
          <input
            type="number"
            min={0}
            max={120000}
            step={100}
            disabled={disabled}
            value={maxValue}
            aria-label={`${label} ${maxLabel}`}
            onChange={e => onMaxChange(Number(e.target.value) || 0)}
          />
        </div>
      </div>
    </div>
  );
}

function humanBehaviorSnapshotFields(values: {
  humanTimingEnabled: boolean;
  humanReplyStyle: 'fast' | 'balanced' | 'careful';
  greetingRepeatCooldownMinutes: number;
  presenceIntentEnabled: boolean;
  suspiciousNameConfirmationEnabled: boolean;
  noTypingDuringDebounce: boolean;
  autoReplyUseQuotedReply: boolean;
  replyToBurstLatestMessage: boolean;
  activeChatWaitMinMs: number;
  activeChatWaitMaxMs: number;
  warmChatWaitMinMs: number;
  warmChatWaitMaxMs: number;
  coldChatWaitMinMs: number;
  coldChatWaitMaxMs: number;
  burstPauseMinMs: number;
  burstPauseMaxMs: number;
  maxBurstWaitMs: number;
  typingMinMs: number;
  typingMaxMs: number;
}) {
  return values;
}

export type AiIntegrationScope = 'provider' | 'autoReply' | 'autoReplyCore' | 'humanBehavior';

type AiIntegrationPanelProps = {
  onBack?: () => void;
  /** Provider/API in Settings; auto-reply rules in Automations. */
  scope?: AiIntegrationScope;
};

function buildFormSnapshot(values: Record<string, unknown>): string {
  return JSON.stringify(values);
}

export function AiIntegrationPanel({ onBack, scope: scopeProp }: AiIntegrationPanelProps) {
  const scope: AiIntegrationScope = scopeProp ?? (onBack ? 'provider' : 'autoReply');
  const showProvider = scope === 'provider';
  const showAutoReply = scope === 'autoReply' || scope === 'autoReplyCore';
  const showHumanBehavior = scope === 'humanBehavior' || scope === 'autoReply';
  const masterSwitchInHealthPanel = scope === 'autoReply' || scope === 'autoReplyCore';
  const { t } = useTranslation();
  const { isAdmin } = useRole();
  const { canView: canViewAiCost, canManage: canManageAiCost } = useAiCostPermissions();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const showApiDocs = canAccessApiDocs(isAdmin);

  const [provider, setProvider] = useState<AiProviderId>('OPENAI');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showStoredApiKey, setShowStoredApiKey] = useState(false);
  const [revealApiKeyLoading, setRevealApiKeyLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [enabled, setEnabled] = useState(false);
  const [toolCalling, setToolCalling] = useState(true);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyPrivateOnly, setAutoReplyPrivateOnly] = useState(true);
  const [autoReplyCooldownMinutes, setAutoReplyCooldownMinutes] = useState(0);
  const [autoReplyContextMessages, setAutoReplyContextMessages] = useState(
    AUTO_REPLY_CONTEXT_MESSAGES_DEFAULT,
  );
  const [autoReplyPrompt, setAutoReplyPrompt] = useState('');
  const [autoReplyPreset, setAutoReplyPreset] = useState('custom');
  const [autoReplyTone, setAutoReplyTone] = useState('');
  const [autoReplyOutsideHoursOnly, setAutoReplyOutsideHoursOnly] = useState(false);
  const [autoReplyTimezone, setAutoReplyTimezone] = useState('Africa/Dar_es_Salaam');
  const [autoReplyStartHour, setAutoReplyStartHour] = useState(9);
  const [autoReplyEndHour, setAutoReplyEndHour] = useState(17);
  const [autoReplyWeekdays, setAutoReplyWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [autoReplyOptOutMessage, setAutoReplyOptOutMessage] = useState('');
  const [autoReplyPreviewInput, setAutoReplyPreviewInput] = useState(
    'Hello, do you have iPhones in stock?',
  );
  const [autoReplyPreviewResult, setAutoReplyPreviewResult] = useState<{
    ok: boolean;
    reply?: string;
    error?: string;
  } | null>(null);
  const [previewingAutoReply, setPreviewingAutoReply] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
    latencyMs?: number;
    reply?: string;
  } | null>(null);

  const [fbProvider, setFbProvider] = useState<AiProviderId>('GROQ');
  const [fbModel, setFbModel] = useState('');
  const [fbApiKey, setFbApiKey] = useState('');
  const [fbBaseUrl, setFbBaseUrl] = useState('');
  const [disabledTools, setDisabledTools] = useState<string[]>([]);
  const [knowledgeRagEnabled, setKnowledgeRagEnabled] = useState(true);
  const [memoryRagEnabled, setMemoryRagEnabled] = useState(true);
  const [progressiveProfilingEnabled, setProgressiveProfilingEnabled] = useState(true);
  const [profilingAutoSaveHighConfidenceNames, setProfilingAutoSaveHighConfidenceNames] =
    useState(true);
  const [profilingRequireReviewMediumConfidence, setProfilingRequireReviewMediumConfidence] =
    useState(true);
  const [profilingDetectNameCorrections, setProfilingDetectNameCorrections] = useState(true);
  const [profilingSilentSaveFields, setProfilingSilentSaveFields] = useState(true);
  const [profilingCreateLostDemandFollowups, setProfilingCreateLostDemandFollowups] =
    useState(true);
  const [profilingAskNameImmediately, setProfilingAskNameImmediately] = useState(false);
  const [profilingDisabledInGroups, setProfilingDisabledInGroups] = useState(true);
  const [profilingMaxQuestionsPerReply, setProfilingMaxQuestionsPerReply] = useState(1);
  const [profilingNameSaveReplyTemplate, setProfilingNameSaveReplyTemplate] = useState(
    'Sawa {name}, ngoja nisave namba yako 😊',
  );
  const [profilingNameCorrectionReply, setProfilingNameCorrectionReply] = useState(
    'Ahaa basi powa nimekupata.',
  );
  const [humanTimingEnabled, setHumanTimingEnabled] = useState(false);
  const [aiUnrestrictedMode, setAiUnrestrictedMode] = useState(false);
  const [humanReplyStyle, setHumanReplyStyle] = useState<'fast' | 'balanced' | 'careful'>('fast');
  const [greetingRepeatCooldownMinutes, setGreetingRepeatCooldownMinutes] = useState(240);
  const [presenceIntentEnabled, setPresenceIntentEnabled] = useState(true);
  const [suspiciousNameConfirmationEnabled, setSuspiciousNameConfirmationEnabled] = useState(true);
  const [noTypingDuringDebounce, setNoTypingDuringDebounce] = useState(true);
  const [autoReplyUseQuotedReply, setAutoReplyUseQuotedReply] = useState(true);
  const [replyToBurstLatestMessage, setReplyToBurstLatestMessage] = useState(true);
  const [activeChatWaitMinMs, setActiveChatWaitMinMs] = useState<number>(HUMAN_TIMING_DEFAULTS.activeChatWaitMinMs);
  const [activeChatWaitMaxMs, setActiveChatWaitMaxMs] = useState<number>(HUMAN_TIMING_DEFAULTS.activeChatWaitMaxMs);
  const [warmChatWaitMinMs, setWarmChatWaitMinMs] = useState<number>(HUMAN_TIMING_DEFAULTS.warmChatWaitMinMs);
  const [warmChatWaitMaxMs, setWarmChatWaitMaxMs] = useState<number>(HUMAN_TIMING_DEFAULTS.warmChatWaitMaxMs);
  const [coldChatWaitMinMs, setColdChatWaitMinMs] = useState<number>(HUMAN_TIMING_DEFAULTS.coldChatWaitMinMs);
  const [coldChatWaitMaxMs, setColdChatWaitMaxMs] = useState<number>(HUMAN_TIMING_DEFAULTS.coldChatWaitMaxMs);
  const [burstPauseMinMs, setBurstPauseMinMs] = useState<number>(HUMAN_TIMING_DEFAULTS.burstPauseMinMs);
  const [burstPauseMaxMs, setBurstPauseMaxMs] = useState<number>(HUMAN_TIMING_DEFAULTS.burstPauseMaxMs);
  const [maxBurstWaitMs, setMaxBurstWaitMs] = useState<number>(HUMAN_TIMING_DEFAULTS.maxBurstWaitMs);
  const [typingMinMs, setTypingMinMs] = useState<number>(HUMAN_TIMING_DEFAULTS.typingMinMs);
  const [typingMaxMs, setTypingMaxMs] = useState<number>(HUMAN_TIMING_DEFAULTS.typingMaxMs);
  const [advancedTimingOpen, setAdvancedTimingOpen] = useState(false);
  const [expertBehaviorOpen, setExpertBehaviorOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [providerMoreOpen, setProviderMoreOpen] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const compact = Boolean(onBack);

  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
  } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiApi.getConfig(),
  });

  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.getStatus(),
    enabled: Boolean(config?.apiKeySet),
    staleTime: 60_000,
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-models', provider],
    queryFn: () => aiApi.getModels(provider),
  });

  const { data: fbModels = [] } = useQuery({
    queryKey: ['ai-models', fbProvider],
    queryFn: () => aiApi.getModels(fbProvider),
  });

  const { data: fallbacks = [] } = useQuery({
    queryKey: ['ai-fallbacks'],
    queryFn: () => aiApi.getFallbacks(),
  });

  const { data: tools = [] } = useQuery({
    queryKey: ['ai-tools'],
    queryFn: () => aiApi.listTools(),
  });

  const { data: autoReplyPresets = [] } = useQuery({
    queryKey: ['ai-auto-reply-presets'],
    queryFn: () => aiApi.getAutoReplyPresets(),
  });

  const autoReplyFieldsDisabled =
    scope === 'humanBehavior'
      ? false
      : masterSwitchInHealthPanel
        ? false
        : !autoReplyEnabled;

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider);
    setModel(config.model);
    setBaseUrl(config.baseUrl ?? '');
    setSystemPrompt(config.systemPrompt ?? '');
    setTemperature(config.temperature);
    setEnabled(config.enabled);
    setToolCalling(config.toolCallingEnabled);
    setAutoReplyEnabled(config.autoReplyEnabled === true);
    setAutoReplyPrivateOnly(config.autoReplyPrivateOnly !== false);
    setAutoReplyCooldownMinutes(config.autoReplyCooldownMinutes ?? 0);
    setAutoReplyContextMessages(
      clampAutoReplyContextMessages(config.autoReplyContextMessages ?? AUTO_REPLY_CONTEXT_MESSAGES_DEFAULT),
    );
    setAutoReplyPrompt(config.autoReplyPrompt ?? '');
    setAutoReplyPreset(config.autoReplyPreset ?? 'custom');
    setAutoReplyTone(config.autoReplyTone ?? '');
    setAutoReplyOutsideHoursOnly(config.autoReplyOutsideHoursOnly === true);
    setAutoReplyTimezone(config.autoReplyTimezone ?? 'Africa/Dar_es_Salaam');
    setAutoReplyStartHour(config.autoReplyStartHour ?? 9);
    setAutoReplyEndHour(config.autoReplyEndHour ?? 17);
    setAutoReplyWeekdays(config.autoReplyWeekdays ?? [1, 2, 3, 4, 5]);
    setAutoReplyOptOutMessage(config.autoReplyOptOutMessage ?? '');
    setDisabledTools(config.disabledTools ?? []);
    setKnowledgeRagEnabled(config.knowledgeRagEnabled !== false);
    setMemoryRagEnabled(config.memoryRagEnabled !== false);
    setProgressiveProfilingEnabled(config.progressiveProfilingEnabled !== false);
    setProfilingAutoSaveHighConfidenceNames(
      config.profilingAutoSaveHighConfidenceNames !== false,
    );
    setProfilingRequireReviewMediumConfidence(
      config.profilingRequireReviewMediumConfidence !== false,
    );
    setProfilingDetectNameCorrections(config.profilingDetectNameCorrections !== false);
    setProfilingSilentSaveFields(config.profilingSilentSaveFields !== false);
    setProfilingCreateLostDemandFollowups(config.profilingCreateLostDemandFollowups !== false);
    setProfilingAskNameImmediately(config.profilingAskNameImmediately === true);
    setProfilingDisabledInGroups(config.profilingDisabledInGroups !== false);
    setProfilingMaxQuestionsPerReply(config.profilingMaxQuestionsPerReply ?? 1);
    setProfilingNameSaveReplyTemplate(
      config.profilingNameSaveReplyTemplate ?? 'Sawa {name}, ngoja nisave namba yako 😊',
    );
    setProfilingNameCorrectionReply(
      config.profilingNameCorrectionReply ?? 'Ahaa basi powa nimekupata.',
    );
    setHumanTimingEnabled(config.humanTimingEnabled === true);
    setAiUnrestrictedMode(config.aiUnrestrictedMode === true);
    setHumanReplyStyle(
      (config.humanReplyStyle as 'fast' | 'balanced' | 'careful') ?? 'fast',
    );
    setGreetingRepeatCooldownMinutes(config.greetingRepeatCooldownMinutes ?? 240);
    setPresenceIntentEnabled(config.presenceIntentEnabled !== false);
    setSuspiciousNameConfirmationEnabled(config.suspiciousNameConfirmationEnabled !== false);
    setNoTypingDuringDebounce(config.noTypingDuringDebounce !== false);
    setAutoReplyUseQuotedReply(config.autoReplyUseQuotedReply !== false);
    setReplyToBurstLatestMessage(config.replyToBurstLatestMessage !== false);
    setActiveChatWaitMinMs(config.activeChatWaitMinMs ?? HUMAN_TIMING_DEFAULTS.activeChatWaitMinMs);
    setActiveChatWaitMaxMs(config.activeChatWaitMaxMs ?? HUMAN_TIMING_DEFAULTS.activeChatWaitMaxMs);
    setWarmChatWaitMinMs(config.warmChatWaitMinMs ?? HUMAN_TIMING_DEFAULTS.warmChatWaitMinMs);
    setWarmChatWaitMaxMs(config.warmChatWaitMaxMs ?? HUMAN_TIMING_DEFAULTS.warmChatWaitMaxMs);
    setColdChatWaitMinMs(config.coldChatWaitMinMs ?? HUMAN_TIMING_DEFAULTS.coldChatWaitMinMs);
    setColdChatWaitMaxMs(config.coldChatWaitMaxMs ?? HUMAN_TIMING_DEFAULTS.coldChatWaitMaxMs);
    setBurstPauseMinMs(config.burstPauseMinMs ?? HUMAN_TIMING_DEFAULTS.burstPauseMinMs);
    setBurstPauseMaxMs(config.burstPauseMaxMs ?? HUMAN_TIMING_DEFAULTS.burstPauseMaxMs);
    setMaxBurstWaitMs(config.maxBurstWaitMs ?? HUMAN_TIMING_DEFAULTS.maxBurstWaitMs);
    setTypingMinMs(config.typingMinMs ?? HUMAN_TIMING_DEFAULTS.typingMinMs);
    setTypingMaxMs(config.typingMaxMs ?? HUMAN_TIMING_DEFAULTS.typingMaxMs);
    setSavedSnapshot(
      buildFormSnapshot({
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl ?? '',
        systemPrompt: config.systemPrompt ?? '',
        temperature: config.temperature,
        enabled: config.enabled,
        toolCalling: config.toolCallingEnabled,
        autoReplyEnabled: config.autoReplyEnabled === true,
        autoReplyPrivateOnly: config.autoReplyPrivateOnly !== false,
        autoReplyCooldownMinutes: config.autoReplyCooldownMinutes ?? 0,
        autoReplyContextMessages: config.autoReplyContextMessages ?? AUTO_REPLY_CONTEXT_MESSAGES_DEFAULT,
        autoReplyPrompt: config.autoReplyPrompt ?? '',
        autoReplyPreset: config.autoReplyPreset ?? 'custom',
        autoReplyTone: config.autoReplyTone ?? '',
        autoReplyOutsideHoursOnly: config.autoReplyOutsideHoursOnly === true,
        autoReplyTimezone: config.autoReplyTimezone ?? 'Africa/Dar_es_Salaam',
        autoReplyStartHour: config.autoReplyStartHour ?? 9,
        autoReplyEndHour: config.autoReplyEndHour ?? 17,
        autoReplyWeekdays: config.autoReplyWeekdays ?? [1, 2, 3, 4, 5],
        autoReplyOptOutMessage: config.autoReplyOptOutMessage ?? '',
        disabledTools: config.disabledTools ?? [],
        knowledgeRagEnabled: config.knowledgeRagEnabled !== false,
        memoryRagEnabled: config.memoryRagEnabled !== false,
        progressiveProfilingEnabled: config.progressiveProfilingEnabled !== false,
        profilingAutoSaveHighConfidenceNames: config.profilingAutoSaveHighConfidenceNames !== false,
        profilingRequireReviewMediumConfidence:
          config.profilingRequireReviewMediumConfidence !== false,
        profilingDetectNameCorrections: config.profilingDetectNameCorrections !== false,
        profilingSilentSaveFields: config.profilingSilentSaveFields !== false,
        profilingCreateLostDemandFollowups: config.profilingCreateLostDemandFollowups !== false,
        profilingAskNameImmediately: config.profilingAskNameImmediately === true,
        profilingDisabledInGroups: config.profilingDisabledInGroups !== false,
        profilingMaxQuestionsPerReply: config.profilingMaxQuestionsPerReply ?? 1,
        profilingNameSaveReplyTemplate:
          config.profilingNameSaveReplyTemplate ?? 'Sawa {name}, ngoja nisave namba yako 😊',
        profilingNameCorrectionReply:
          config.profilingNameCorrectionReply ?? 'Ahaa basi powa nimekupata.',
        ...humanBehaviorSnapshotFields({
          humanTimingEnabled: config.humanTimingEnabled === true,
          humanReplyStyle:
            (config.humanReplyStyle as 'fast' | 'balanced' | 'careful') ?? 'fast',
          greetingRepeatCooldownMinutes: config.greetingRepeatCooldownMinutes ?? 240,
          presenceIntentEnabled: config.presenceIntentEnabled !== false,
          suspiciousNameConfirmationEnabled: config.suspiciousNameConfirmationEnabled !== false,
          noTypingDuringDebounce: config.noTypingDuringDebounce !== false,
          autoReplyUseQuotedReply: config.autoReplyUseQuotedReply !== false,
          replyToBurstLatestMessage: config.replyToBurstLatestMessage !== false,
          activeChatWaitMinMs: config.activeChatWaitMinMs ?? HUMAN_TIMING_DEFAULTS.activeChatWaitMinMs,
          activeChatWaitMaxMs: config.activeChatWaitMaxMs ?? HUMAN_TIMING_DEFAULTS.activeChatWaitMaxMs,
          warmChatWaitMinMs: config.warmChatWaitMinMs ?? HUMAN_TIMING_DEFAULTS.warmChatWaitMinMs,
          warmChatWaitMaxMs: config.warmChatWaitMaxMs ?? HUMAN_TIMING_DEFAULTS.warmChatWaitMaxMs,
          coldChatWaitMinMs: config.coldChatWaitMinMs ?? HUMAN_TIMING_DEFAULTS.coldChatWaitMinMs,
          coldChatWaitMaxMs: config.coldChatWaitMaxMs ?? HUMAN_TIMING_DEFAULTS.coldChatWaitMaxMs,
          burstPauseMinMs: config.burstPauseMinMs ?? HUMAN_TIMING_DEFAULTS.burstPauseMinMs,
          burstPauseMaxMs: config.burstPauseMaxMs ?? HUMAN_TIMING_DEFAULTS.burstPauseMaxMs,
          maxBurstWaitMs: config.maxBurstWaitMs ?? HUMAN_TIMING_DEFAULTS.maxBurstWaitMs,
          typingMinMs: config.typingMinMs ?? HUMAN_TIMING_DEFAULTS.typingMinMs,
          typingMaxMs: config.typingMaxMs ?? HUMAN_TIMING_DEFAULTS.typingMaxMs,
        }),
        aiUnrestrictedMode: config.aiUnrestrictedMode === true,
      }),
    );
    if (config.testStatus === 'ok') {
      setTestResult({ ok: true, latencyMs: 0 });
    } else if (config.testStatus === 'error' && config.testError) {
      setTestResult({ ok: false, error: formatAiErrorMessage(config.testError) });
    }
  }, [config]);

  useEffect(() => {
    if (models.length > 0 && !models.includes(model)) {
      setModel(models[0]);
    }
  }, [models, model]);

  useEffect(() => {
    if (fbModels.length > 0 && !fbModels.includes(fbModel)) {
      setFbModel(fbModels[0]);
    }
  }, [fbModels, fbModel]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const keyToSave = apiKey.trim();
      await aiApi.saveConfig({
        provider,
        model,
        ...(keyToSave ? { apiKey: keyToSave } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        systemPrompt,
        temperature,
        enabled,
        toolCallingEnabled: toolCalling,
        ...(masterSwitchInHealthPanel
          ? { autoReplyEnabled: config?.autoReplyEnabled === true }
          : { autoReplyEnabled }),
        autoReplyPrivateOnly,
        autoReplyCooldownMinutes,
        autoReplyContextMessages: clampAutoReplyContextMessages(autoReplyContextMessages),
        autoReplyPrompt,
        autoReplyPreset,
        autoReplyTone,
        autoReplyOutsideHoursOnly,
        autoReplyTimezone,
        autoReplyStartHour,
        autoReplyEndHour,
        autoReplyWeekdays,
        autoReplyOptOutMessage: autoReplyOptOutMessage.trim() || undefined,
        disabledTools,
        knowledgeRagEnabled,
        memoryRagEnabled,
        progressiveProfilingEnabled,
        profilingAutoSaveHighConfidenceNames,
        profilingRequireReviewMediumConfidence,
        profilingDetectNameCorrections,
        profilingSilentSaveFields,
        profilingCreateLostDemandFollowups,
        profilingAskNameImmediately,
        profilingDisabledInGroups,
        profilingMaxQuestionsPerReply,
        profilingNameSaveReplyTemplate: profilingNameSaveReplyTemplate.trim() || undefined,
        profilingNameCorrectionReply: profilingNameCorrectionReply.trim() || undefined,
        humanTimingEnabled,
        aiUnrestrictedMode,
        humanReplyStyle,
        greetingRepeatCooldownMinutes,
        presenceIntentEnabled,
        suspiciousNameConfirmationEnabled,
        noTypingDuringDebounce,
        autoReplyUseQuotedReply,
        replyToBurstLatestMessage,
        activeChatWaitMinMs,
        activeChatWaitMaxMs,
        warmChatWaitMinMs,
        warmChatWaitMaxMs,
        coldChatWaitMinMs,
        coldChatWaitMaxMs,
        burstPauseMinMs,
        burstPauseMaxMs,
        maxBurstWaitMs,
        typingMinMs,
        typingMaxMs,
      });
      return { keyToSave };
    },
    onSuccess: ({ keyToSave }) => {
      toast.success(t('ai.settings.saved'));
      if (keyToSave) {
        setApiKey(keyToSave);
        setShowStoredApiKey(true);
      }
      setTestResult(null);
      setSavedSnapshot(
        buildFormSnapshot({
          provider,
          model,
          baseUrl,
          systemPrompt,
          temperature,
          enabled,
          toolCalling,
          autoReplyEnabled,
          autoReplyPrivateOnly,
          autoReplyCooldownMinutes,
          autoReplyContextMessages: clampAutoReplyContextMessages(autoReplyContextMessages),
          autoReplyPrompt,
          autoReplyPreset,
          autoReplyTone,
          autoReplyOutsideHoursOnly,
          autoReplyTimezone,
          autoReplyStartHour,
          autoReplyEndHour,
          autoReplyWeekdays,
          autoReplyOptOutMessage,
          disabledTools,
          knowledgeRagEnabled,
          memoryRagEnabled,
          progressiveProfilingEnabled,
          profilingAutoSaveHighConfidenceNames,
          profilingRequireReviewMediumConfidence,
          profilingDetectNameCorrections,
          profilingSilentSaveFields,
          profilingCreateLostDemandFollowups,
          profilingAskNameImmediately,
          profilingDisabledInGroups,
          profilingMaxQuestionsPerReply,
          profilingNameSaveReplyTemplate,
          profilingNameCorrectionReply,
          ...humanBehaviorSnapshotFields({
            humanTimingEnabled,
            humanReplyStyle,
            greetingRepeatCooldownMinutes,
            presenceIntentEnabled,
            suspiciousNameConfirmationEnabled,
            noTypingDuringDebounce,
            autoReplyUseQuotedReply,
            replyToBurstLatestMessage,
            activeChatWaitMinMs,
            activeChatWaitMaxMs,
            warmChatWaitMinMs,
            warmChatWaitMaxMs,
            coldChatWaitMinMs,
            coldChatWaitMaxMs,
            burstPauseMinMs,
            burstPauseMaxMs,
            maxBurstWaitMs,
            typingMinMs,
            typingMaxMs,
          }),
          aiUnrestrictedMode,
        }),
      );
      void qc.invalidateQueries({ queryKey: ['ai-config'] });
      void qc.invalidateQueries({ queryKey: ['ai-status'] });
      void qc.invalidateQueries({ queryKey: ['ai', 'auto-reply', 'health'] });
    },
    onError: (err: Error) => toast.error(err.message || t('ai.settings.saveFailed')),
  });

  const applyUnrestrictedMutation = useMutation({
    mutationFn: () => aiApi.applyUnrestrictedAutoReply(),
    onSuccess: res => {
      toast.success(
        t('ai.settings.unrestrictedApplied', { count: res.resumedThreads ?? 0 }),
      );
      void qc.invalidateQueries({ queryKey: ['ai-config'] });
      void qc.invalidateQueries({ queryKey: ['ai', 'auto-reply', 'health'] });
      void qc.invalidateQueries({ queryKey: ['whatsapp-safety-settings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearKeyMutation = useMutation({
    mutationFn: () => aiApi.clearApiKey(),
    onSuccess: () => {
      toast.success(t('ai.settings.keyCleared'));
      setApiKey('');
      setShowStoredApiKey(false);
      setTestResult(null);
      void qc.invalidateQueries({ queryKey: ['ai-config'] });
    },
    onError: () => toast.error(t('ai.settings.keyClearFailed')),
  });

  const addFallbackMutation = useMutation({
    mutationFn: () =>
      aiApi.addFallback({
        provider: fbProvider,
        model: fbModel,
        ...(fbApiKey ? { apiKey: fbApiKey } : {}),
        ...(fbBaseUrl ? { baseUrl: fbBaseUrl } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-fallbacks'] });
      setFbApiKey('');
      setFbBaseUrl('');
      toast.success(t('ai.settings.fallbackAdded'));
    },
    onError: () => toast.error(t('ai.settings.fallbackFailed')),
  });

  const removeFallbackMutation = useMutation({
    mutationFn: (index: number) => aiApi.removeFallback(index),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ai-fallbacks'] }),
  });

  const reindexMutation = useMutation({
    mutationFn: async () => {
      const [knowledge, memory] = await Promise.all([
        aiApi.reindexKnowledge(),
        aiApi.reindexMemory(),
      ]);
      return { knowledge, memory };
    },
    onSuccess: () => {
      toast.success(t('ai.settings.reindexDone'));
      void qc.invalidateQueries({ queryKey: ['ai-status'] });
      void qc.invalidateQueries({ queryKey: ['ai-knowledge'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewAutoReply = async () => {
    setPreviewingAutoReply(true);
    setAutoReplyPreviewResult(null);
    try {
      const res = await aiApi.previewAutoReply(autoReplyPreviewInput.trim() || undefined);
      setAutoReplyPreviewResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ai.settings.autoReplyPreviewFailed');
      setAutoReplyPreviewResult({ ok: false, error: formatAiErrorMessage(msg) });
    } finally {
      setPreviewingAutoReply(false);
    }
  };

  const testAi = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await aiApi.test();
      if (res.ok) {
        setTestResult(res);
      } else {
        setTestResult({
          ok: false,
          error: formatAiErrorMessage(res.error ?? t('ai.settings.testFailed')),
        });
      }
      void qc.invalidateQueries({ queryKey: ['ai-config'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ai.settings.testFailed');
      setTestResult({ ok: false, error: formatAiErrorMessage(msg) });
    } finally {
      setTesting(false);
    }
  };

  const needsBaseUrl = provider === 'OLLAMA' || provider === 'CUSTOM';
  const fbNeedsBaseUrl = fbProvider === 'OLLAMA' || fbProvider === 'CUSTOM';
  const providerKeyUrl = getAiProviderKeyUrl(provider);
  const fbProviderKeyUrl = getAiProviderKeyUrl(fbProvider);
  const unsavedKey = apiKey.trim().length > 0;
  const canTest = !!config?.apiKeySet && !unsavedKey;

  const toggleStoredApiKeyVisibility = async () => {
    if (showStoredApiKey) {
      setShowStoredApiKey(false);
      return;
    }
    if (config?.apiKeySet && !apiKey.trim()) {
      setRevealApiKeyLoading(true);
      try {
        const { apiKey: revealed } = await aiApi.revealApiKey();
        if (revealed) {
          setApiKey(revealed);
        } else {
          toast.error(t('ai.settings.revealApiKeyFailed'));
          setRevealApiKeyLoading(false);
          return;
        }
      } catch {
        toast.error(t('ai.settings.revealApiKeyFailed'));
        setRevealApiKeyLoading(false);
        return;
      }
      setRevealApiKeyLoading(false);
    }
    setShowStoredApiKey(true);
  };

  const currentSnapshot = useMemo(
    () =>
      buildFormSnapshot({
        provider,
        model,
        baseUrl,
        systemPrompt,
        temperature,
        enabled,
        toolCalling,
        autoReplyEnabled,
        autoReplyPrivateOnly,
        autoReplyCooldownMinutes,
        autoReplyContextMessages: clampAutoReplyContextMessages(autoReplyContextMessages),
        autoReplyPrompt,
        autoReplyPreset,
        autoReplyTone,
        autoReplyOutsideHoursOnly,
        autoReplyTimezone,
        autoReplyStartHour,
        autoReplyEndHour,
        autoReplyWeekdays,
        autoReplyOptOutMessage,
        disabledTools,
        knowledgeRagEnabled,
        memoryRagEnabled,
        progressiveProfilingEnabled,
        profilingAutoSaveHighConfidenceNames,
        profilingRequireReviewMediumConfidence,
        profilingDetectNameCorrections,
        profilingSilentSaveFields,
        profilingCreateLostDemandFollowups,
        profilingAskNameImmediately,
        profilingDisabledInGroups,
        profilingMaxQuestionsPerReply,
        profilingNameSaveReplyTemplate,
        profilingNameCorrectionReply,
        ...humanBehaviorSnapshotFields({
          humanTimingEnabled,
          humanReplyStyle,
          greetingRepeatCooldownMinutes,
          presenceIntentEnabled,
          suspiciousNameConfirmationEnabled,
          noTypingDuringDebounce,
          autoReplyUseQuotedReply,
          replyToBurstLatestMessage,
          activeChatWaitMinMs,
          activeChatWaitMaxMs,
          warmChatWaitMinMs,
          warmChatWaitMaxMs,
          coldChatWaitMinMs,
          coldChatWaitMaxMs,
          burstPauseMinMs,
          burstPauseMaxMs,
          maxBurstWaitMs,
          typingMinMs,
          typingMaxMs,
        }),
        aiUnrestrictedMode,
    }),
    [
      provider,
      model,
      baseUrl,
      systemPrompt,
      temperature,
      enabled,
      toolCalling,
      autoReplyEnabled,
      autoReplyPrivateOnly,
      autoReplyCooldownMinutes,
      autoReplyContextMessages,
      autoReplyPrompt,
      autoReplyPreset,
      autoReplyTone,
      autoReplyOutsideHoursOnly,
      autoReplyTimezone,
      autoReplyStartHour,
      autoReplyEndHour,
      autoReplyWeekdays,
      autoReplyOptOutMessage,
      disabledTools,
      knowledgeRagEnabled,
      memoryRagEnabled,
      progressiveProfilingEnabled,
      profilingAutoSaveHighConfidenceNames,
      profilingRequireReviewMediumConfidence,
      profilingDetectNameCorrections,
      profilingSilentSaveFields,
      profilingCreateLostDemandFollowups,
      profilingAskNameImmediately,
      profilingDisabledInGroups,
      profilingMaxQuestionsPerReply,
      profilingNameSaveReplyTemplate,
      profilingNameCorrectionReply,
      humanTimingEnabled,
      aiUnrestrictedMode,
      humanReplyStyle,
      greetingRepeatCooldownMinutes,
      presenceIntentEnabled,
      suspiciousNameConfirmationEnabled,
      noTypingDuringDebounce,
      autoReplyUseQuotedReply,
      replyToBurstLatestMessage,
      activeChatWaitMinMs,
      activeChatWaitMaxMs,
      warmChatWaitMinMs,
      warmChatWaitMaxMs,
      coldChatWaitMinMs,
      coldChatWaitMaxMs,
      burstPauseMinMs,
      burstPauseMaxMs,
      maxBurstWaitMs,
      typingMinMs,
      typingMaxMs,
    ],
  );

  const isDirty = unsavedKey || (savedSnapshot !== '' && currentSnapshot !== savedSnapshot);

  const toggleTool = (toolName: string, checked: boolean) => {
    setDisabledTools(prev => {
      if (checked) return prev.filter(name => name !== toolName);
      return prev.includes(toolName) ? prev : [...prev, toolName];
    });
  };

  const semanticHealthPercent = useMemo(() => {
    if (!aiStatus) return null;
    const total = aiStatus.memory.chunks + aiStatus.knowledge.chunks;
    if (!aiStatus.memory.vectorSearch || total <= 0) return null;
    return Math.min(99.9, 90 + Math.log10(total + 1) * 5).toFixed(1);
  }, [aiStatus]);

  const agentActive = Boolean(config?.apiKeySet && config.enabled);
  const agentBadge = !config?.apiKeySet
    ? { label: t('ai.settings.agentInactive'), tone: 'muted' as const }
    : !config.enabled
      ? { label: t('ai.settings.agentDisabled'), tone: 'muted' as const }
      : config.testStatus === 'error'
        ? { label: t('ai.settings.agentError'), tone: 'warn' as const }
        : { label: t('ai.settings.agentActive'), tone: 'active' as const };

  const semanticMeta = semanticHealthPercent
    ? t('ai.settings.semanticSearchHealth', { percent: semanticHealthPercent })
    : aiStatus
      ? t('ai.settings.semanticSearchMeta', {
          memory: aiStatus.memory.chunks,
          knowledge: aiStatus.knowledge.chunks,
          vector: aiStatus.memory.vectorSearch ? t('ai.settings.vectorOn') : '',
        })
      : t('ai.settings.semanticSearchPending');

  const toggleWeekday = (day: number) => {
    setAutoReplyWeekdays(prev =>
      prev.includes(day)
        ? prev.filter(x => x !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  };

  if (configLoading) {
    return (
      <div className="ai-settings-shell ai-settings-shell--loading">
        <Loader2 className="animate-spin" size={24} />
        <span>{t('ai.settings.loading')}</span>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="ai-settings-shell">
        <p className="ai-settings-test err">
          <XCircle size={16} /> {t('ai.settings.loadFailed')}
        </p>
      </div>
    );
  }

  const statusCard =
    config?.apiKeySet ? (
      <div className="ai-settings-status-card">
        <div className="ai-settings-status-card__icon">
          <MaterialSymbol name="psychology" size={22} filled />
        </div>
        <div>
          <div className="ai-settings-status-card__title">
            {t('ai.settings.agentStatus')}
            <span
              className={`ai-settings-status-card__badge${
                agentBadge.tone === 'muted'
                  ? ' ai-settings-status-card__badge--muted'
                  : agentBadge.tone === 'warn'
                    ? ' ai-settings-status-card__badge--warn'
                    : ''
              }`}
            >
              {agentBadge.label}
            </span>
          </div>
          <p className="ai-settings-status-card__meta">{semanticMeta}</p>
        </div>
      </div>
    ) : null;

  const saveButton = (
    <button
      type="button"
      className="fu-btn fu-btn--primary"
      disabled={saveMutation.isPending || (showProvider && !model) || !isDirty}
      onClick={() => saveMutation.mutate()}
    >
      {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
      {t('ai.settings.save')}
    </button>
  );

  const settingsBody = (
    <>
      {showProvider && !compact && (
        <AiSetupChecklist
          onNavigate={id => navigate(settingsPanelHref(id))}
          onNavigateAutoReply={() => navigate(settingsPanelHref('ai-auto-reply'))}
        />
      )}
      {showProvider && !compact && canViewAiCost && (
        <p className="ai-settings-card__hint" style={{ marginBottom: 12 }}>
          <Link to={settingsPanelHref('ai-usage')}>{t('ai.usage.title')}</Link> — {t('ai.usage.integrationHint')}
        </p>
      )}
      {showProvider && !compact && canManageAiCost && (
        <AiCostSettingsSection config={config} />
      )}
      {!onBack && showProvider && (
        <section className="ai-settings-hero">
          <div className="ai-settings-hero__text">
            <h2>{t('ai.settings.heroTitle')}</h2>
            <p>{t('ai.settings.desc')}</p>
          </div>
          {statusCard}
        </section>
      )}

      {showProvider && (
      <div className="ai-settings-card ai-settings-card--elevated">
        <div className="ai-settings-card__head">
          <h3 className="ai-settings-card__title">
            <MaterialSymbol name="hub" size={20} />
            {t('ai.settings.primaryProvider')}
          </h3>
          {config?.apiKeySet && config.testStatus === 'ok' && (
            <span className="ai-settings-connected">
              <MaterialSymbol name="verified" size={16} />
              {t('ai.settings.statusReady')}
            </span>
          )}
        </div>

        <div className="ai-settings-grid ai-settings-grid--4">
          <div className="ai-settings-field">
            <label className="ai-settings-label">{t('ai.settings.provider')}</label>
            <select value={provider} onChange={e => setProvider(e.target.value as AiProviderId)}>
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>
                  {t(p.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="ai-settings-field">
            <label className="ai-settings-label">{t('ai.settings.modelId')}</label>
            {modelsLoading ? (
              <div className="ai-settings-inline-loading">
                <Loader2 className="animate-spin" size={14} /> {t('ai.settings.modelsLoading')}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  list="ai-model-suggestions"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder={t('ai.settings.noModels')}
                />
                {models.length > 0 && (
                  <datalist id="ai-model-suggestions">
                    {models.map(m => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                )}
              </>
            )}
          </div>
          <div className="ai-settings-field ai-settings-field--span-2">
            <div className="ai-settings-label-row">
              <label className="ai-settings-label">{t('ai.settings.apiKey')}</label>
              <Link
                to={settingsPanelHref('api-keys')}
                className="ai-settings-get-key"
              >
                {t('ai.settings.manageKeys')}
                <MaterialSymbol name="open_in_new" size={12} />
              </Link>
            </div>
            <div className="ai-settings-key-row">
              <div className="ai-settings-key-input-wrap">
                <input
                  type={showStoredApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={
                    config?.apiKeySet
                      ? t('ai.settings.apiKeyPlaceholderSet')
                      : t('ai.settings.apiKeyPlaceholder')
                  }
                  autoComplete="off"
                />
                {(config?.apiKeySet || apiKey.trim()) && (
                  <button
                    type="button"
                    className="ai-settings-key-toggle"
                    disabled={revealApiKeyLoading}
                    onClick={() => void toggleStoredApiKeyVisibility()}
                    aria-label={
                      showStoredApiKey
                        ? t('ai.settings.hideApiKey')
                        : t('ai.settings.showApiKey')
                    }
                  >
                    {revealApiKeyLoading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : showStoredApiKey ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                )}
              </div>
              {config?.apiKeySet && (
                <button
                  type="button"
                  className="fu-btn fu-btn--ghost fu-btn--sm"
                  disabled={clearKeyMutation.isPending}
                  onClick={() => clearKeyMutation.mutate()}
                >
                  {t('ai.settings.clearKey')}
                </button>
              )}
            </div>
            {config?.apiKeySource === 'environment' && (
              <p className="ai-settings-card__hint" style={{ marginTop: '0.35rem' }}>
                {t('ai.settings.apiKeyFromEnvironment')}
              </p>
            )}
            {providerKeyUrl && (
              <a
                href={providerKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ai-settings-get-key"
                style={{ marginTop: '0.35rem', display: 'inline-flex' }}
              >
                {t('ai.settings.getApiKey')}
                <ExternalLink size={12} aria-hidden />
              </a>
            )}
          </div>
          {needsBaseUrl && (
            <div className="ai-settings-field ai-settings-field--span-2">
              <label className="ai-settings-label">{t('ai.settings.baseUrl')}</label>
              <input
                type="url"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder={
                  provider === 'OLLAMA'
                    ? 'http://localhost:11434/v1'
                    : 'https://your-api.example/v1'
                }
              />
            </div>
          )}
        </div>

        <div className="ai-settings-toggles-row">
          <ToggleSwitch
            checked={enabled}
            onChange={setEnabled}
            label={t('ai.settings.enabled')}
          />
          <ToggleSwitch
            checked={toolCalling}
            onChange={setToolCalling}
            label={t('ai.settings.toolCalling')}
          />
        </div>

        <div className="ai-settings-field">
          <label className="ai-settings-label">{t('ai.settings.staffInstructions')}</label>
          <textarea
            rows={2}
            value={systemPrompt}
            placeholder={t('ai.settings.promptPlaceholder')}
            onChange={e => setSystemPrompt(e.target.value)}
          />
        </div>

        <div className="ai-settings-card__foot">
          <button
            type="button"
            className="fu-btn fu-btn--ghost"
            disabled={testing || !canTest}
            title={unsavedKey ? t('ai.settings.saveBeforeTest') : undefined}
            onClick={() => void testAi()}
          >
            {testing ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
            {t('ai.settings.test')}
          </button>
          {saveButton}
        </div>

        {unsavedKey && (
          <p className="ai-settings-field-hint">{t('ai.settings.saveBeforeTest')}</p>
        )}
        {testResult && (
          <p className={`ai-settings-test ${testResult.ok ? 'ok' : 'err'}`}>
            {testResult.ok ? (
              <>
                <CheckCircle size={14} /> {t('ai.settings.testOk', { ms: testResult.latencyMs ?? 0 })}
                {testResult.reply ? ` — ${testResult.reply}` : ''}
              </>
            ) : (
              <>
                <XCircle size={14} /> {testResult.error}
              </>
            )}
          </p>
        )}
      </div>
      )}

      {showProvider && compact && !providerMoreOpen ? (
        <button
          type="button"
          className="ai-settings-advanced-timing__toggle ai-settings-more-options"
          aria-expanded={false}
          onClick={() => setProviderMoreOpen(true)}
        >
          <span>{t('ai.settings.moreOptionsTitle')}</span>
          <ChevronDown size={18} aria-hidden />
        </button>
      ) : null}

      {showProvider && !compact && (
      <div className="ai-settings-card">
        <div className="ai-settings-card__head">
          <h3 className="ai-settings-card__title">
            <MaterialSymbol name="reply_all" size={20} />
            {t('ai.settings.advancedAutoReply')}
          </h3>
        </div>
        <p className="ai-settings-field-hint" style={{ margin: '0 0 0.75rem' }}>
          {t('ai.settings.autoReplyInAutomationsHint')}
        </p>
          <Link to={settingsPanelHref('ai-auto-reply')} className="fu-btn fu-btn--ghost fu-btn--sm">
            {t('settings.items.aiReplies.title')}
          </Link>
        </div>
      )}

      {showAutoReply && compact && !moreOptionsOpen ? (
        <div className="ai-settings-card ai-settings-card--elevated ai-settings-card--compact">
          <div className="ai-settings-card__head">
            <h3 className="ai-settings-card__title">
              <MaterialSymbol name="forum" size={20} />
              {t('settings.items.aiReplies.title')}
            </h3>
            {masterSwitchInHealthPanel ? (
              <p className="ai-settings-field-hint ai-settings-card__head-hint">
                {t('automations.autoReplyHealth.masterSwitchHint')}
              </p>
            ) : (
              <ToggleSwitch
                checked={autoReplyEnabled}
                onChange={setAutoReplyEnabled}
                label={autoReplyEnabled ? t('ai.settings.toggleOn') : t('ai.settings.toggleOff')}
              />
            )}
          </div>
          <div className="ai-settings-space-y">
            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.primaryInstructions')}</label>
              <textarea
                rows={3}
                value={autoReplyPrompt}
                disabled={autoReplyFieldsDisabled}
                placeholder={t('ai.settings.autoReplyPromptPlaceholder')}
                onChange={e => {
                  setAutoReplyPrompt(e.target.value);
                  if (autoReplyPreset !== 'custom') setAutoReplyPreset('custom');
                }}
              />
            </div>
            <ToggleSwitch
              checked={humanTimingEnabled}
              onChange={setHumanTimingEnabled}
              disabled={autoReplyFieldsDisabled || aiUnrestrictedMode}
              label={t('ai.settings.humanTimingEnabled')}
            />
            <ToggleSwitch
              checked={aiUnrestrictedMode}
              onChange={setAiUnrestrictedMode}
              disabled={autoReplyFieldsDisabled}
              label={t('ai.settings.aiUnrestrictedMode')}
            />
            {aiUnrestrictedMode ? (
              <>
                <p className="ai-settings-field-hint ai-settings-pacing-warning">
                  {t('ai.settings.aiUnrestrictedModeWarning')}
                </p>
                <button
                  type="button"
                  className="fu-btn fu-btn--secondary fu-btn--sm"
                  disabled={applyUnrestrictedMutation.isPending}
                  onClick={() => applyUnrestrictedMutation.mutate()}
                >
                  {applyUnrestrictedMutation.isPending
                    ? t('ai.settings.applyingUnrestricted')
                    : t('ai.settings.applyUnrestrictedNow')}
                </button>
              </>
            ) : null}
            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.humanReplyStyle')}</label>
              <select
                value={humanReplyStyle}
                disabled={autoReplyFieldsDisabled}
                onChange={e =>
                  setHumanReplyStyle(e.target.value as 'fast' | 'balanced' | 'careful')
                }
              >
                <option value="fast">{t('ai.settings.humanReplyStyleFast')}</option>
                <option value="balanced">{t('ai.settings.humanReplyStyleBalanced')}</option>
                <option value="careful">{t('ai.settings.humanReplyStyleCareful')}</option>
              </select>
            </div>
            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.autoReplyCooldownMinutes')}</label>
              <input
                type="number"
                min={0}
                max={1440}
                value={autoReplyCooldownMinutes}
                disabled={autoReplyFieldsDisabled}
                onChange={e =>
                  setAutoReplyCooldownMinutes(
                    Math.min(1440, Math.max(0, Number(e.target.value) || 0)),
                  )
                }
              />
            </div>
          </div>
          <button
            type="button"
            className="ai-settings-advanced-timing__toggle ai-settings-more-options"
            aria-expanded={false}
            onClick={() => setMoreOptionsOpen(true)}
          >
            <span>{t('ai.settings.moreOptionsTitle')}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
        </div>
      ) : null}

      {showAutoReply && (!compact || moreOptionsOpen) && (
      <>
      {compact ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm ai-settings-show-less"
          onClick={() => setMoreOptionsOpen(false)}
        >
          {t('ai.settings.showLess')}
        </button>
      ) : null}
      <div className="ai-settings-grid ai-settings-grid--2">
        <div className="ai-settings-card ai-settings-card--elevated">
          <div className="ai-settings-card__head">
            <h3 className="ai-settings-card__title">
              <MaterialSymbol name="reply_all" size={20} />
              {t('ai.settings.advancedAutoReply')}
            </h3>
            {masterSwitchInHealthPanel ? (
              <p className="ai-settings-field-hint ai-settings-card__head-hint">
                {t('automations.autoReplyHealth.masterSwitchHint')}
              </p>
            ) : (
              <ToggleSwitch
                checked={autoReplyEnabled}
                onChange={setAutoReplyEnabled}
                label={autoReplyEnabled ? t('ai.settings.toggleOn') : t('ai.settings.toggleOff')}
              />
            )}
          </div>

          <div className="ai-settings-space-y">
            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.primaryInstructions')}</label>
              <textarea
                rows={4}
                value={autoReplyPrompt}
                disabled={autoReplyFieldsDisabled}
                placeholder={t('ai.settings.autoReplyPromptPlaceholder')}
                onChange={e => {
                  setAutoReplyPrompt(e.target.value);
                  if (autoReplyPreset !== 'custom') setAutoReplyPreset('custom');
                }}
              />
            </div>

            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.autoReplyOptOutMessage')}</label>
              <input
                type="text"
                value={autoReplyOptOutMessage}
                disabled={autoReplyFieldsDisabled}
                placeholder={t('ai.settings.autoReplyOptOutMessagePlaceholder')}
                onChange={e => setAutoReplyOptOutMessage(e.target.value)}
              />
            </div>

            <div className="ai-settings-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.autoReplyCooldownMinutes')}</label>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={autoReplyCooldownMinutes}
                  disabled={autoReplyFieldsDisabled}
                  onChange={e =>
                    setAutoReplyCooldownMinutes(
                      Math.min(1440, Math.max(0, Number(e.target.value) || 0)),
                    )
                  }
                />
                <p className="ai-settings-field-hint">{t('ai.settings.cooldownZeroHint')}</p>
              </div>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.autoReplyContextMessages')}</label>
                <input
                  type="number"
                  min={AUTO_REPLY_CONTEXT_MESSAGES_MIN}
                  max={AUTO_REPLY_CONTEXT_MESSAGES_MAX}
                  value={autoReplyContextMessages}
                  disabled={autoReplyFieldsDisabled}
                  onChange={e =>
                    setAutoReplyContextMessages(
                      clampAutoReplyContextMessages(Number(e.target.value)),
                    )
                  }
                />
                <p className="ai-settings-field-hint">
                  {t('ai.settings.autoReplyContextMessagesHint')}
                </p>
              </div>
            </div>

            <div className="ai-settings-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.autoReplyPreset')}</label>
                <select
                  value={autoReplyPreset}
                  disabled={autoReplyFieldsDisabled}
                  onChange={e => {
                    const id = e.target.value;
                    setAutoReplyPreset(id);
                    const preset = autoReplyPresets.find(p => p.id === id);
                    if (preset && id !== 'custom') {
                      setAutoReplyTone(preset.tone);
                      if (!autoReplyPrompt.trim() && preset.prompt) {
                        setAutoReplyPrompt(preset.prompt);
                      }
                    }
                  }}
                >
                  {autoReplyPresets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.autoReplyTone')}</label>
                <input
                  type="text"
                  value={autoReplyTone}
                  disabled={autoReplyFieldsDisabled}
                  placeholder={t('ai.settings.autoReplyTonePlaceholder')}
                  onChange={e => setAutoReplyTone(e.target.value)}
                />
              </div>
            </div>

            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.temperature')}</label>
              <div className="wa-range-row ai-settings-range-row">
                <input
                  type="range"
                  className="wa-range-slider"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  disabled={autoReplyFieldsDisabled}
                  style={{ '--range-pct': `${temperature * 100}%` } as CSSProperties}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                />
                <span className="wa-range-value ai-settings-range-value">{temperature.toFixed(1)}</span>
              </div>
            </div>

            <label className="ai-settings-check-row">
              <input
                type="checkbox"
                checked={autoReplyPrivateOnly}
                disabled={autoReplyFieldsDisabled}
                onChange={e => setAutoReplyPrivateOnly(e.target.checked)}
              />
              <div>
                <div className="ai-settings-check-row__title">
                  {t('ai.settings.autoReplyPrivateOnly')}
                </div>
              </div>
            </label>

            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.autoReplyPreviewLabel')}</label>
              <input
                type="text"
                value={autoReplyPreviewInput}
                disabled={autoReplyFieldsDisabled}
                onChange={e => setAutoReplyPreviewInput(e.target.value)}
                placeholder={t('ai.settings.autoReplyPreviewPlaceholder')}
              />
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="fu-btn fu-btn--ghost fu-btn--sm"
                  disabled={previewingAutoReply || !enabled || !config?.apiKeySet}
                  onClick={() => void previewAutoReply()}
                >
                  {previewingAutoReply ? <Loader2 className="animate-spin" size={14} /> : null}
                  {t('ai.settings.autoReplyPreview')}
                </button>
              </div>
              {autoReplyPreviewResult && (
                <p
                  className={`ai-settings-preview-box ${autoReplyPreviewResult.ok ? '' : 'ai-settings-test err'}`}
                >
                  {autoReplyPreviewResult.ok
                    ? autoReplyPreviewResult.reply
                    : autoReplyPreviewResult.error}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="ai-settings-card ai-settings-card--elevated">
          <div className="ai-settings-card__head">
            <h3 className="ai-settings-card__title">
              <MaterialSymbol name="schedule" size={20} />
              {t('ai.settings.operationalConstraints')}
            </h3>
          </div>

          <div className="ai-settings-space-y">
            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.autoReplyTimezone')}</label>
              <select
                value={autoReplyTimezone}
                onChange={e => setAutoReplyTimezone(e.target.value)}
              >
                {!TIMEZONE_OPTIONS.includes(autoReplyTimezone) && (
                  <option value={autoReplyTimezone}>{autoReplyTimezone}</option>
                )}
                {TIMEZONE_OPTIONS.map(tz => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="ai-settings-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.autoReplyStartHour')}</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={autoReplyStartHour}
                  onChange={e => setAutoReplyStartHour(Number(e.target.value) || 0)}
                />
              </div>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.autoReplyEndHour')}</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={autoReplyEndHour}
                  onChange={e => setAutoReplyEndHour(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.autoReplyWeekdays')}</label>
              <div className="ai-settings-day-pills">
                {AUTO_REPLY_WEEKDAYS.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    className={`ai-settings-day-pill${
                      autoReplyWeekdays.includes(d.value) ? ' is-active' : ''
                    }`}
                    onClick={() => toggleWeekday(d.value)}
                  >
                    {t(d.labelKey).toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <label className="ai-settings-check-row">
              <input
                type="checkbox"
                checked={autoReplyOutsideHoursOnly}
                disabled={autoReplyFieldsDisabled}
                onChange={e => setAutoReplyOutsideHoursOnly(e.target.checked)}
              />
              <div>
                <div className="ai-settings-check-row__title">
                  {t('ai.settings.autoReplyOutsideHoursOnly')}
                </div>
                <p className="ai-settings-check-row__hint">
                  {t('ai.settings.autoReplyOutsideHoursHint')}
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {showHumanBehavior && (
        <div className="ai-settings-card ai-settings-card--elevated" style={{ marginTop: '0.75rem' }}>
          <div className="ai-settings-card__head">
            <h3 className="ai-settings-card__title">
              <MaterialSymbol name="schedule" size={20} />
              {t('ai.settings.humanBehaviorTitle')}
            </h3>
          </div>
          <p className="ai-settings-field-hint" style={{ margin: '0 0 0.75rem' }}>
            {t('ai.settings.humanBehaviorDesc')}
          </p>
          <div className="ai-settings-space-y">
            <ToggleSwitch
              checked={aiUnrestrictedMode}
              onChange={setAiUnrestrictedMode}
              disabled={autoReplyFieldsDisabled}
              label={t('ai.settings.aiUnrestrictedMode')}
            />
            {aiUnrestrictedMode ? (
              <>
                <p className="ai-settings-field-hint ai-settings-pacing-warning">
                  {t('ai.settings.aiUnrestrictedModeWarning')}
                </p>
                <button
                  type="button"
                  className="fu-btn fu-btn--secondary fu-btn--sm"
                  disabled={applyUnrestrictedMutation.isPending}
                  onClick={() => applyUnrestrictedMutation.mutate()}
                >
                  {applyUnrestrictedMutation.isPending
                    ? t('ai.settings.applyingUnrestricted')
                    : t('ai.settings.applyUnrestrictedNow')}
                </button>
              </>
            ) : null}
            <ToggleSwitch
              checked={humanTimingEnabled}
              onChange={setHumanTimingEnabled}
              disabled={autoReplyFieldsDisabled || aiUnrestrictedMode}
              label={t('ai.settings.humanTimingEnabled')}
            />
            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.humanReplyStyle')}</label>
              <select
                value={humanReplyStyle}
                disabled={autoReplyFieldsDisabled}
                onChange={e =>
                  setHumanReplyStyle(e.target.value as 'fast' | 'balanced' | 'careful')
                }
              >
                <option value="fast">{t('ai.settings.humanReplyStyleFast')}</option>
                <option value="balanced">{t('ai.settings.humanReplyStyleBalanced')}</option>
                <option value="careful">{t('ai.settings.humanReplyStyleCareful')}</option>
              </select>
              <p className="ai-settings-field-hint" style={{ marginTop: '0.35rem' }}>
                {t(`ai.settings.humanTimingPresetHint_${humanReplyStyle}`)}
              </p>
            </div>
            <div className="ai-settings-field">
              <label className="ai-settings-label">{t('ai.settings.humanTimingWindowsTitle')}</label>
              <p className="ai-settings-field-hint" style={{ margin: 0 }}>
                {t('ai.settings.humanTimingWindowsDesc')}
              </p>
            </div>
            <div className="ai-settings-field">
              <label className="ai-settings-label">
                {t('ai.settings.greetingRepeatCooldownMinutes')}
              </label>
              <input
                type="number"
                min={0}
                max={10080}
                disabled={autoReplyFieldsDisabled}
                value={greetingRepeatCooldownMinutes}
                onChange={e => setGreetingRepeatCooldownMinutes(Number(e.target.value) || 0)}
              />
            </div>
            <div className="ai-settings-advanced-timing">
              <button
                type="button"
                className={`ai-settings-advanced-timing__toggle${expertBehaviorOpen ? ' is-open' : ''}`}
                aria-expanded={expertBehaviorOpen}
                disabled={autoReplyFieldsDisabled}
                onClick={() => setExpertBehaviorOpen(open => !open)}
              >
                <span>{t('ai.settings.expertBehaviorTitle')}</span>
                <ChevronDown size={18} aria-hidden />
              </button>
              {expertBehaviorOpen && (
                <div className="ai-settings-advanced-timing__body">
                  <p className="ai-settings-field-hint">{t('ai.settings.expertBehaviorDesc')}</p>
                  <ToggleSwitch
                    checked={presenceIntentEnabled}
                    onChange={setPresenceIntentEnabled}
                    disabled={autoReplyFieldsDisabled}
                    label={t('ai.settings.presenceIntentEnabled')}
                  />
                  <ToggleSwitch
                    checked={suspiciousNameConfirmationEnabled}
                    onChange={setSuspiciousNameConfirmationEnabled}
                    disabled={autoReplyFieldsDisabled}
                    label={t('ai.settings.suspiciousNameConfirmationEnabled')}
                  />
                  <ToggleSwitch
                    checked={noTypingDuringDebounce}
                    onChange={setNoTypingDuringDebounce}
                    disabled={autoReplyFieldsDisabled}
                    label={t('ai.settings.noTypingDuringDebounce')}
                  />
                  <ToggleSwitch
                    checked={autoReplyUseQuotedReply}
                    onChange={setAutoReplyUseQuotedReply}
                    disabled={autoReplyFieldsDisabled}
                    label={t('ai.settings.autoReplyUseQuotedReply')}
                  />
                  <ToggleSwitch
                    checked={replyToBurstLatestMessage}
                    onChange={setReplyToBurstLatestMessage}
                    disabled={autoReplyFieldsDisabled}
                    label={t('ai.settings.replyToBurstLatestMessage')}
                  />
                </div>
              )}
            </div>

            <div className="ai-settings-advanced-timing">
              <button
                type="button"
                className={`ai-settings-advanced-timing__toggle${advancedTimingOpen ? ' is-open' : ''}`}
                aria-expanded={advancedTimingOpen}
                disabled={autoReplyFieldsDisabled}
                onClick={() => setAdvancedTimingOpen(open => !open)}
              >
                <span>{t('ai.settings.advancedTimingTitle')}</span>
                <ChevronDown size={18} aria-hidden />
              </button>
              {advancedTimingOpen && (
                <div className="ai-settings-advanced-timing__body">
                  <p className="ai-settings-field-hint">{t('ai.settings.advancedTimingDesc')}</p>
                  <MsRangeField
                    label={t('ai.settings.activeChatWait')}
                    hint={t('ai.settings.activeChatWaitHint')}
                    minLabel={t('ai.settings.timingMinMs')}
                    maxLabel={t('ai.settings.timingMaxMs')}
                    minValue={activeChatWaitMinMs}
                    maxValue={activeChatWaitMaxMs}
                    disabled={autoReplyFieldsDisabled || !humanTimingEnabled}
                    onMinChange={setActiveChatWaitMinMs}
                    onMaxChange={setActiveChatWaitMaxMs}
                  />
                  <MsRangeField
                    label={t('ai.settings.warmChatWait')}
                    hint={t('ai.settings.warmChatWaitHint')}
                    minLabel={t('ai.settings.timingMinMs')}
                    maxLabel={t('ai.settings.timingMaxMs')}
                    minValue={warmChatWaitMinMs}
                    maxValue={warmChatWaitMaxMs}
                    disabled={autoReplyFieldsDisabled || !humanTimingEnabled}
                    onMinChange={setWarmChatWaitMinMs}
                    onMaxChange={setWarmChatWaitMaxMs}
                  />
                  <MsRangeField
                    label={t('ai.settings.coldChatWait')}
                    hint={t('ai.settings.coldChatWaitHint')}
                    minLabel={t('ai.settings.timingMinMs')}
                    maxLabel={t('ai.settings.timingMaxMs')}
                    minValue={coldChatWaitMinMs}
                    maxValue={coldChatWaitMaxMs}
                    disabled={autoReplyFieldsDisabled || !humanTimingEnabled}
                    onMinChange={setColdChatWaitMinMs}
                    onMaxChange={setColdChatWaitMaxMs}
                  />
                  <MsRangeField
                    label={t('ai.settings.burstPauseWait')}
                    hint={t('ai.settings.burstPauseWaitHint')}
                    minLabel={t('ai.settings.timingMinMs')}
                    maxLabel={t('ai.settings.timingMaxMs')}
                    minValue={burstPauseMinMs}
                    maxValue={burstPauseMaxMs}
                    disabled={autoReplyFieldsDisabled || !humanTimingEnabled}
                    onMinChange={setBurstPauseMinMs}
                    onMaxChange={setBurstPauseMaxMs}
                  />
                  <div className="ai-settings-field">
                    <label className="ai-settings-label">{t('ai.settings.maxBurstWaitMs')}</label>
                    <p className="ai-settings-field-hint">{t('ai.settings.maxBurstWaitMsHint')}</p>
                    <input
                      type="number"
                      min={0}
                      max={120000}
                      step={1000}
                      disabled={autoReplyFieldsDisabled || !humanTimingEnabled}
                      value={maxBurstWaitMs}
                      onChange={e => setMaxBurstWaitMs(Number(e.target.value) || 0)}
                    />
                  </div>
                  <MsRangeField
                    label={t('ai.settings.typingDuration')}
                    hint={t('ai.settings.typingDurationHint')}
                    minLabel={t('ai.settings.timingMinMs')}
                    maxLabel={t('ai.settings.timingMaxMs')}
                    minValue={typingMinMs}
                    maxValue={typingMaxMs}
                    disabled={autoReplyFieldsDisabled || !humanTimingEnabled}
                    onMinChange={setTypingMinMs}
                    onMaxChange={setTypingMaxMs}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(showAutoReply || showHumanBehavior) && !onBack && (
        <div className="ai-settings-card__foot" style={{ marginTop: '0.5rem' }}>
          {saveButton}
        </div>
      )}
      </>
      )}

      {showAutoReply && canManageAiCost && (!compact || moreOptionsOpen) && (
        <AiCostSettingsSection
          config={config}
          showModelRouting={false}
          showCostSafety={false}
          showContextControl
          showDedupe
        />
      )}

      {showAutoReply && (!compact || moreOptionsOpen) && (
      <section className="ai-settings-profiling-hero interakt-glass-card">
        <div className="ai-settings-profiling-hero__head">
          <div className="ai-settings-profiling-hero__title-row">
            <span className="ai-settings-profiling-hero__icon">
              <MaterialSymbol name="psychology_alt" size={24} />
            </span>
            <div>
              <h3>{t('ai.settings.progressiveProfiling')}</h3>
              <p>{t('ai.settings.progressiveProfilingDesc')}</p>
            </div>
          </div>
          <ToggleSwitch
            checked={progressiveProfilingEnabled}
            onChange={setProgressiveProfilingEnabled}
            label={
              progressiveProfilingEnabled ? t('ai.settings.toggleOn') : t('ai.settings.toggleOff')
            }
          />
        </div>
        <div className="ai-settings-profiling-hero__body">
          <div className="interakt-check-grid">
            <InteraktCheckOption
              checked={profilingAutoSaveHighConfidenceNames}
              disabled={!progressiveProfilingEnabled}
              onChange={setProfilingAutoSaveHighConfidenceNames}
              title={t('ai.settings.profilingAutoSaveNames')}
              hint={t('ai.settings.profilingAutoSaveNamesHint')}
            />
            <InteraktCheckOption
              checked={profilingRequireReviewMediumConfidence}
              disabled={!progressiveProfilingEnabled}
              onChange={setProfilingRequireReviewMediumConfidence}
              title={t('ai.settings.profilingReviewMedium')}
              hint={t('ai.settings.profilingReviewMediumHint', {
                defaultValue:
                  "Pushes suspected names to the Review tab instead of updating the CRM immediately.",
              })}
            />
            <InteraktCheckOption
              checked={profilingDetectNameCorrections}
              disabled={!progressiveProfilingEnabled}
              onChange={setProfilingDetectNameCorrections}
              title={t('ai.settings.profilingDetectCorrections')}
              hint={t('ai.settings.profilingDetectCorrectionsHint', {
                defaultValue:
                  'AI automatically handles scenarios like "Actually, my name is spelt with a K".',
              })}
            />
            <InteraktCheckOption
              checked={profilingSilentSaveFields}
              disabled={!progressiveProfilingEnabled}
              onChange={setProfilingSilentSaveFields}
              title={t('ai.settings.profilingSilentSave')}
              hint={t('ai.settings.profilingSilentSaveHint', {
                defaultValue:
                  'Updates customer profile with city, favorite products, and delivery notes without interrupting flow.',
              })}
            />
            <InteraktCheckOption
              checked={profilingCreateLostDemandFollowups}
              disabled={!progressiveProfilingEnabled}
              onChange={setProfilingCreateLostDemandFollowups}
              title={t('ai.settings.profilingLostDemand')}
              hint={t('ai.settings.profilingLostDemandHint', {
                defaultValue:
                  'Automates the creation of tasks when customers ask for currently out-of-stock items.',
              })}
            />
            <InteraktCheckOption
              checked={profilingDisabledInGroups}
              disabled={!progressiveProfilingEnabled}
              onChange={setProfilingDisabledInGroups}
              title={t('ai.settings.profilingDisableGroups')}
              hint={t('ai.settings.profilingDisableGroupsHint', {
                defaultValue: 'Ensure AI only learns from 1-on-1 private customer conversations.',
              })}
            />
          </div>
          <div className="ai-settings-profiling-hero__templates">
            <div className="ai-settings-field">
              <label className="ai-settings-label">
                {t('ai.settings.profilingNameSaveTemplate')}
              </label>
              <textarea
                className="ai-settings-textarea"
                rows={2}
                value={profilingNameSaveReplyTemplate}
                disabled={!progressiveProfilingEnabled}
                onChange={e => setProfilingNameSaveReplyTemplate(e.target.value)}
              />
            </div>
            <div className="ai-settings-field">
              <label className="ai-settings-label">
                {t('ai.settings.profilingNameCorrectionReply')}
              </label>
              <textarea
                className="ai-settings-textarea"
                rows={1}
                value={profilingNameCorrectionReply}
                disabled={!progressiveProfilingEnabled}
                onChange={e => setProfilingNameCorrectionReply(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>
      )}

      {showProvider && compact && providerMoreOpen ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm ai-settings-show-less"
          onClick={() => setProviderMoreOpen(false)}
        >
          {t('ai.settings.showLess')}
        </button>
      ) : null}

      {showProvider && (!compact || providerMoreOpen) && (
      <div className="ai-settings-card">
        <div className="ai-settings-card__head">
          <h3 className="ai-settings-card__title">
            <MaterialSymbol name="database" size={20} />
            {t('ai.settings.capabilityTools')}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            {agentActive && (
              <span className="ai-settings-engine-badge">
                <span className="ai-settings-engine-badge__dot" />
                {t('ai.settings.engineOnline')}
              </span>
            )}
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm"
              disabled={reindexMutation.isPending}
              onClick={() => reindexMutation.mutate()}
            >
              {reindexMutation.isPending ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <MaterialSymbol name="sync" size={16} />
              )}
              {t('ai.settings.reindexAll')}
            </button>
          </div>
        </div>

        <div className="ai-settings-feature-grid">
          <div className="ai-settings-feature-card">
            <Link
              to={settingsPanelHref('ai-knowledge')}
              className="ai-settings-feature-card__link"
            >
              <span className="ai-settings-feature-card__icon ai-settings-feature-card__icon--shop">
                <MaterialSymbol name="shopping_bag" size={20} />
              </span>
              <span className="ai-settings-feature-card__text">
                <span className="ai-settings-feature-card__title">
                  {t('ai.settings.shopKnowledge')}
                </span>
                <span className="ai-settings-feature-card__desc">
                  {t('ai.settings.shopKnowledgeDesc')}
                </span>
              </span>
            </Link>
            <ToggleSwitch
              checked={knowledgeRagEnabled}
              onChange={setKnowledgeRagEnabled}
              label={knowledgeRagEnabled ? t('ai.settings.toggleOn') : t('ai.settings.toggleOff')}
            />
          </div>
          <div className="ai-settings-feature-card">
            <Link
              to={settingsPanelHref('ai-memory')}
              className="ai-settings-feature-card__link"
            >
              <span className="ai-settings-feature-card__icon ai-settings-feature-card__icon--memory">
                <MaterialSymbol name="psychology" size={20} />
              </span>
              <span className="ai-settings-feature-card__text">
                <span className="ai-settings-feature-card__title">
                  {t('ai.settings.neuralMemory')}
                </span>
                <span className="ai-settings-feature-card__desc">
                  {t('ai.settings.neuralMemoryDesc')}
                </span>
              </span>
            </Link>
            <ToggleSwitch
              checked={memoryRagEnabled}
              onChange={setMemoryRagEnabled}
              label={memoryRagEnabled ? t('ai.settings.toggleOn') : t('ai.settings.toggleOff')}
            />
          </div>
        </div>

        <div className="ai-settings-tools-wrap">
          <div className="ai-settings-tools-scroll">
            <table className="ai-settings-tools-table">
              <thead>
                <tr>
                  <th>{t('ai.settings.toolKey')}</th>
                  <th>{t('ai.settings.toolDescription')}</th>
                  <th>{t('ai.settings.toolEnabled')}</th>
                </tr>
              </thead>
              <tbody>
                {tools.map(tool => {
                  const memoryBlocked =
                    !memoryRagEnabled && tool.name.startsWith('memory_');
                  const toolOn =
                    toolCalling && !disabledTools.includes(tool.name) && !memoryBlocked;
                  return (
                  <tr key={tool.name}>
                    <td>
                      <code>{tool.name}</code>
                    </td>
                    <td>{tool.description}</td>
                    <td className="interakt-tool-status">
                      <button
                        type="button"
                        className={`interakt-tool-status__${toolOn ? 'on' : 'off'}`}
                        disabled={!toolCalling}
                        aria-label={tool.name}
                        onClick={() => toggleTool(tool.name, !toolOn)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          cursor: toolCalling ? 'pointer' : 'default',
                        }}
                      >
                        <MaterialSymbol
                          name={toolOn ? 'check_circle' : 'radio_button_unchecked'}
                          size={20}
                          filled={toolOn}
                        />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="ai-settings-field-hint" style={{ marginTop: '0.65rem', fontStyle: 'normal' }}>
          {t('ai.settings.toolsHint')}
        </p>
      </div>
      )}

      {showProvider && (!compact || providerMoreOpen) && (
      <div className="ai-settings-card">
        <div className="ai-settings-card__head">
          <h3 className="ai-settings-card__title">
            <MaterialSymbol name="alt_route" size={20} />
            {t('ai.settings.fallbackSection')}
          </h3>
          {fallbacks.length < 5 && (
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm"
              disabled={addFallbackMutation.isPending || !fbModel}
              onClick={() => addFallbackMutation.mutate()}
            >
              <Plus size={16} />
              {t('ai.settings.addFallback')}
            </button>
          )}
        </div>

        <div className="ai-settings-fallback-list">
          {(fallbacks as AiFallbackEntry[]).map((f, i) => (
            <div key={`${f.provider}-${f.model}-${i}`} className="ai-settings-fallback-row">
              <div className="ai-settings-fallback-row__rank">
                <span
                  className={`ai-settings-fallback-row__num${
                    i > 0 ? ' ai-settings-fallback-row__num--muted' : ''
                  }`}
                >
                  {i + 1}
                </span>
                <div className="ai-settings-field" style={{ flex: 1, margin: 0 }}>
                  <label className="ai-settings-label">{t('ai.settings.provider')}</label>
                  <select value={f.provider} disabled>
                    <option>{f.provider}</option>
                  </select>
                </div>
              </div>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.model')}</label>
                <input type="text" value={f.model} readOnly />
              </div>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.keyStatus')}</label>
                <div
                  className={`ai-settings-fallback-key${
                    f.apiKeySet ? '' : ' ai-settings-fallback-key--empty'
                  }`}
                >
                  {f.apiKeyHint ??
                    (f.apiKeySet ? t('ai.settings.keyActive') : t('ai.settings.keyMissing'))}
                </div>
              </div>
              <button
                type="button"
                className="ai-settings-fallback-delete"
                onClick={() => removeFallbackMutation.mutate(i)}
                aria-label={t('common.delete')}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        {fallbacks.length < 5 && (
          <div className="ai-settings-add-form">
            <div className="ai-settings-grid ai-settings-grid--4">
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.provider')}</label>
                <select
                  value={fbProvider}
                  onChange={e => setFbProvider(e.target.value as AiProviderId)}
                >
                  {PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>
                      {t(p.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ai-settings-field">
                <label className="ai-settings-label">{t('ai.settings.model')}</label>
                <select value={fbModel} onChange={e => setFbModel(e.target.value)}>
                  {fbModels.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {fbNeedsBaseUrl && (
                <div className="ai-settings-field">
                  <label className="ai-settings-label">{t('ai.settings.baseUrl')}</label>
                  <input
                    type="url"
                    value={fbBaseUrl}
                    onChange={e => setFbBaseUrl(e.target.value)}
                  />
                </div>
              )}
              <div className="ai-settings-field">
                <div className="ai-settings-label-row">
                  <label className="ai-settings-label">{t('ai.settings.fallbackApiKey')}</label>
                  {fbProviderKeyUrl && (
                    <a
                      href={fbProviderKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ai-settings-get-key"
                    >
                      {t('ai.settings.getApiKey')}
                      <ExternalLink size={12} aria-hidden />
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  value={fbApiKey}
                  onChange={e => setFbApiKey(e.target.value)}
                  placeholder={t('ai.settings.fallbackApiKeyHint')}
                />
              </div>
            </div>
          </div>
        )}

        <p className="ai-settings-fallback-hint">{t('ai.settings.fallbackHint')}</p>
      </div>
      )}

      {showProvider && !compact && (
      <footer className="ai-settings-footer">
        <div className="ai-settings-footer__links">
          {showApiDocs ? (
            <a href="/api/docs" target="_blank" rel="noopener noreferrer" className="ai-settings-footer__link">
              <MaterialSymbol name="description" size={18} />
              {t('ai.settings.documentation')}
            </a>
          ) : null}
          <Link to="/ai" className="ai-settings-footer__link">
            <MaterialSymbol name="forum" size={18} />
            {t('ai.settings.communitySupport')}
          </Link>
        </div>
        <Link to="/ai" className="ai-settings-footer__chat">
          {t('ai.settings.openChat')}
          <MaterialSymbol name="arrow_forward" size={18} />
        </Link>
      </footer>
      )}
    </>
  );

  if (onBack) {
    return (
      <SettingsIntegrationShell
        chromeless
        backSection="ai"
        onBack={onBack}
        title={
          showAutoReply
            ? t('settings.items.aiReplies.title')
            : t('settings.ai.configureAi')
        }
        status={statusCard}
        headerActions={
          showAutoReply ? (
            <SettingsAskAiButton prompt="Zima AI auto reply" />
          ) : (
            <SettingsAskAiButton prompt="Reindex AI knowledge" />
          )
        }
        onSave={() => saveMutation.mutate()}
        saveDisabled={(showProvider && !model) || !isDirty}
        isSaving={saveMutation.isPending}
        isDirty={isDirty}
      >
        <div className="ai-settings-body">{settingsBody}</div>
      </SettingsIntegrationShell>
    );
  }

  return (
    <SettingsFormPage>
      <div className="ai-settings-shell">{settingsBody}</div>
    </SettingsFormPage>
  );
}
