import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import { automationsHref } from '../../../lib/automations-routes';
import type { WhatsAppCheckSendResult } from '../../../services/api';
import type { Session } from '../../../services/api';
import { MaterialSymbol } from '../../MaterialSymbol';
import { RULES_SECTIONS, usePolicyToggleRow } from './whatsapp-safety-shared';
import {
  WHATSAPP_REPLY_PACING_PRESETS,
  detectWhatsAppReplyPacingPreset,
  type WhatsAppReplyPacingPreset,
} from '../../../lib/whatsapp-safety-pacing';

const TOGGLE_LABELS: Record<string, string> = {
  globalEnabled: 'whatsappSafety.toggles.globalEnabled',
  outside24hRequiresTemplate: 'whatsappSafety.toggles.outside24h',
  startupSafeModeEnabled: 'whatsappSafety.toggles.startupSafeMode',
  warmupEnabled: 'whatsappSafety.toggles.warmup',
  followupAutoSendEnabled: 'whatsappSafety.toggles.followupAutoSend',
  campaignsEnabled: 'whatsappSafety.toggles.campaigns',
  productBulkSendEnabled: 'whatsappSafety.toggles.productBulkSend',
  groupManagementEnabled: 'whatsappSafety.toggles.groupManagement',
  statusPostsEnabled: 'whatsappSafety.toggles.statusPosts',
};

type Props = {
  merged: Record<string, unknown>;
  toggle: (key: string) => void;
  patchFields: (patch: Record<string, unknown>) => void;
  sessions: Session[];
  checkSessionId: string;
  onCheckSessionIdChange: (id: string) => void;
  checkChatId: string;
  onCheckChatIdChange: (id: string) => void;
  checkBody: string;
  onCheckBodyChange: (body: string) => void;
  checkResult: WhatsAppCheckSendResult | null;
  checkSend: UseMutationResult<WhatsAppCheckSendResult, Error, void, unknown>;
};

export function WhatsAppSafetyRulesTab({
  merged,
  toggle,
  patchFields,
  sessions,
  checkSessionId,
  onCheckSessionIdChange,
  checkChatId,
  onCheckChatIdChange,
  checkBody,
  onCheckBodyChange,
  checkResult,
  checkSend,
}: Props) {
  const { t } = useTranslation();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const renderPolicyToggleRow = usePolicyToggleRow(merged, toggle);
  const advancedSection = RULES_SECTIONS.find(
    s => s.titleKey === 'whatsappSafety.rules.sections.advanced',
  );

  const pacingValues = {
    minAiReplyDelayMs: Number(merged.minAiReplyDelayMs ?? 15_000),
    maxAiReplyDelayMs: Number(merged.maxAiReplyDelayMs ?? 90_000),
    minDelayBetweenMessagesMs: Number(merged.minDelayBetweenMessagesMs ?? 8_000),
  };
  const pacingPreset = detectWhatsAppReplyPacingPreset(pacingValues);

  const applyPacingPreset = (preset: WhatsAppReplyPacingPreset) => {
    if (preset === 'custom') return;
    patchFields(WHATSAPP_REPLY_PACING_PRESETS[preset]);
  };

  return (
    <div className="wa-safety-bento">
      <section className="wa-safety-rules-section">
        <h3 className="wa-safety-section-title">{t('whatsappSafety.rules.sections.pacing')}</h3>
        <p className="wa-safety-section-hint">{t('whatsappSafety.pacing.hint')}</p>
        <label className="wa-safety-field">
          <span>{t('whatsappSafety.pacing.preset')}</span>
          <select
            value={pacingPreset}
            onChange={e => applyPacingPreset(e.target.value as WhatsAppReplyPacingPreset)}
          >
            <option value="standard">{t('whatsappSafety.pacing.presets.standard')}</option>
            <option value="balanced">{t('whatsappSafety.pacing.presets.balanced')}</option>
            <option value="fast">{t('whatsappSafety.pacing.presets.fast')}</option>
            <option value="instant">{t('whatsappSafety.pacing.presets.instant')}</option>
            <option value="custom">{t('whatsappSafety.pacing.presets.custom')}</option>
          </select>
        </label>
        {pacingPreset === 'fast' && (
          <p className="wa-safety-section-hint wa-safety-pacing-warning">
            {t('whatsappSafety.pacing.fastWarning')}
          </p>
        )}
        <div className="wa-safety-pacing-grid">
          <label className="wa-safety-field">
            <span>{t('whatsappSafety.pacing.minAiDelay')}</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={pacingValues.minAiReplyDelayMs}
              onChange={e =>
                patchFields({ minAiReplyDelayMs: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>
          <label className="wa-safety-field">
            <span>{t('whatsappSafety.pacing.maxAiDelay')}</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={pacingValues.maxAiReplyDelayMs}
              onChange={e =>
                patchFields({ maxAiReplyDelayMs: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>
          <label className="wa-safety-field">
            <span>{t('whatsappSafety.pacing.minGap')}</span>
            <input
              type="number"
              min={0}
              step={500}
              value={pacingValues.minDelayBetweenMessagesMs}
              onChange={e =>
                patchFields({
                  minDelayBetweenMessagesMs: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
        </div>
        <p className="wa-safety-muted">{t('whatsappSafety.pacing.unitsHint')}</p>
      </section>

      {RULES_SECTIONS.filter(s => s.titleKey !== 'whatsappSafety.rules.sections.advanced').map(
        section => (
          <section key={section.titleKey} className="wa-safety-rules-section">
            <h3 className="wa-safety-section-title">{t(section.titleKey)}</h3>
            {section.titleKey === 'whatsappSafety.rules.sections.automations' && (
              <p className="wa-safety-section-hint">
                {t('whatsappSafety.autoReplyMasterHint')}{' '}
                <Link to={automationsHref('autoReply')} className="wa-safety-alert__link">
                  {t('settings.ai.openAutoReply')}
                </Link>
              </p>
            )}
            <div className="wa-safety-policy-rows">
              {section.keys.map(key =>
                renderPolicyToggleRow(String(key), TOGGLE_LABELS[String(key)] ?? String(key)),
              )}
            </div>
          </section>
        ),
      )}

      <section className="wa-safety-rules-section wa-safety-accordion">
        <button
          type="button"
          className="wa-safety-accordion__trigger"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen(open => !open)}
        >
          <h3 className="wa-safety-section-title">{t('whatsappSafety.rules.sections.advanced')}</h3>
          <MaterialSymbol
            name={advancedOpen ? 'expand_less' : 'expand_more'}
            size={22}
            aria-hidden
          />
        </button>
        {advancedOpen && advancedSection ? (
          <div className="wa-safety-accordion__body">
            <div className="wa-safety-policy-rows">
              {advancedSection.keys.map(key =>
                renderPolicyToggleRow(String(key), TOGGLE_LABELS[String(key)] ?? String(key)),
              )}
            </div>

            <div className="wa-safety-bento--nested">
              <h4 className="wa-safety-section-title">{t('whatsappSafety.checkSend.title')}</h4>
              <p className="wa-safety-section-hint">{t('whatsappSafety.checkSend.hint')}</p>
              <label className="wa-safety-field">
                <span>{t('whatsappSafety.checkSend.session')}</span>
                <select
                  value={checkSessionId}
                  onChange={e => onCheckSessionIdChange(e.target.value)}
                >
                  <option value="">—</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wa-safety-field">
                <span>{t('whatsappSafety.checkSend.chatId')}</span>
                <input
                  type="text"
                  value={checkChatId}
                  onChange={e => onCheckChatIdChange(e.target.value)}
                  placeholder="255700000000@c.us"
                />
              </label>
              <label className="wa-safety-field">
                <span>{t('whatsappSafety.checkSend.body')}</span>
                <textarea rows={3} value={checkBody} onChange={e => onCheckBodyChange(e.target.value)} />
              </label>
              <button
                type="button"
                className="wa-safety-btn wa-safety-btn--primary"
                disabled={
                  checkSend.isPending || !checkSessionId || !checkChatId.trim() || !checkBody.trim()
                }
                onClick={() => checkSend.mutate()}
              >
                {checkSend.isPending
                  ? t('whatsappSafety.checkSend.running')
                  : t('whatsappSafety.checkSend.run')}
              </button>
              {checkResult && (
                <p className="wa-safety-muted">
                  {checkResult.blocked
                    ? t('whatsappSafety.checkSend.blocked', { reason: checkResult.reason })
                    : checkResult.queued
                      ? t('whatsappSafety.checkSend.queued', { reason: checkResult.reason })
                      : t('whatsappSafety.checkSend.allowed', { reason: checkResult.reason })}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
