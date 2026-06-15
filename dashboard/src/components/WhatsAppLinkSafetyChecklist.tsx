import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import { whatsAppSafetyApi, type WhatsAppLinkPreflightItem } from '../services/api';
import { useRole } from '../hooks/useRole';
import {
  buildLinkPreflightTogglePatch,
  buildLinkSafetyAutoFixPatch,
  countAutoFixableLinkSafetyIssues,
  getLinkPreflightToggleBinding,
  groupLinkPreflightItems,
  linkPreflightFixHref,
  readLinkPreflightToggleValue,
} from '../lib/whatsapp-link-safety.util';
import './WhatsAppLinkSafetyModal.css';

export type LinkSafetyChecklistMode = 'link' | 'settings';

type Props = {
  sessionId?: string;
  mode?: LinkSafetyChecklistMode;
  /** Settings embed inside WhatsApp Safety bento card — hides summary, uses wide rows. */
  embedded?: boolean;
  /** Clinical Clarity modal layout matching link preflight mockup. */
  variant?: 'default' | 'modal';
  hint?: string;
  ackInFooter?: boolean;
  ackWarnings?: boolean;
  onAckChange?: (value: boolean) => void;
  onMetaChange?: (meta: { recommendedOk: boolean; ready: boolean }) => void;
  onNavigateAway?: () => void;
  onReadyChange?: (ready: boolean) => void;
};

function isEnvVarDetail(detail?: string | null): boolean {
  return Boolean(detail && /^[A-Z][A-Z0-9_]*=/.test(detail.trim()));
}

export function WhatsAppLinkSafetyChecklist({
  sessionId,
  mode = 'link',
  embedded = false,
  variant = 'default',
  hint,
  ackInFooter = false,
  ackWarnings: ackWarningsProp,
  onAckChange,
  onMetaChange,
  onNavigateAway,
  onReadyChange,
}: Props) {
  const { t } = useTranslation();
  const { isAdmin } = useRole();
  const qc = useQueryClient();
  const [ackWarningsInternal, setAckWarningsInternal] = useState(false);
  const [fixingField, setFixingField] = useState<string | null>(null);
  const [fixingAll, setFixingAll] = useState(false);

  const ackWarnings = ackWarningsProp ?? ackWarningsInternal;
  const setAckWarnings = onAckChange ?? setAckWarningsInternal;
  const isModal = variant === 'modal' && !embedded;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['whatsapp-safety', 'link-preflight', sessionId ?? 'global'],
    queryFn: () => whatsAppSafetyApi.getLinkPreflight(sessionId),
    retry: false,
  });

  const { data: safetySettings } = useQuery({
    queryKey: ['whatsapp-safety', 'settings'],
    queryFn: () => whatsAppSafetyApi.getSettings(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (onAckChange) onAckChange(false);
    else setAckWarningsInternal(false);
  }, [sessionId, onAckChange]);

  const groups = useMemo(() => (data ? groupLinkPreflightItems(data) : null), [data]);

  const canProceed = useMemo(() => {
    if (mode !== 'link' || !data) return false;
    if (!data.blockingOk) return false;
    if (!data.recommendedOk && !ackWarnings) return false;
    return true;
  }, [mode, data, ackWarnings]);

  useEffect(() => {
    onReadyChange?.(canProceed);
  }, [canProceed, onReadyChange]);

  useEffect(() => {
    if (!data) return;
    onMetaChange?.({ recommendedOk: data.recommendedOk, ready: data.ready });
  }, [data, onMetaChange]);

  const autoFixableCount = useMemo(
    () => (data ? countAutoFixableLinkSafetyIssues(data.items) : 0),
    [data],
  );

  const progressPct = data && data.total > 0 ? (data.completed / data.total) * 100 : 0;

  const fixAll = useCallback(async () => {
    if (!data) return;
    const patch = buildLinkSafetyAutoFixPatch(data.items);
    if (Object.keys(patch).length === 0) return;
    setFixingAll(true);
    try {
      await whatsAppSafetyApi.patchSettings(patch as never);
      await qc.invalidateQueries({ queryKey: ['whatsapp-safety'] });
      await refetch();
    } finally {
      setFixingAll(false);
    }
  }, [data, qc, refetch]);

  const applyToggle = useCallback(
    async (itemId: string, patch: Record<string, boolean>) => {
      setFixingField(itemId);
      try {
        await whatsAppSafetyApi.patchSettings(patch as never);
        await qc.invalidateQueries({ queryKey: ['whatsapp-safety'] });
        await refetch();
      } finally {
        setFixingField(null);
      }
    },
    [qc, refetch],
  );

  const renderModalItem = (item: WhatsAppLinkPreflightItem, _tier: 'required' | 'recommended') => {
    const label = t(`whatsappLinkSafety.items.${item.id}`);
    const href = sessionId ? linkPreflightFixHref(item, sessionId) : null;
    const toggleBinding =
      safetySettings && isAdmin ? getLinkPreflightToggleBinding(item) : null;
    const toggleValue =
      toggleBinding && safetySettings
        ? readLinkPreflightToggleValue(toggleBinding, safetySettings)
        : false;
    const isToggling = fixingField === item.id;

    if (item.id === 'enginePreference' && !item.ok) {
      return (
        <li key={item.id} className="wa-link-safety__item wa-link-safety__item--engine-warn">
          <div className="wa-link-safety__item-main">
            <MaterialSymbol name="warning" size={20} className="wa-link-safety__warn-icon" />
            <div>
              <p className="wa-link-safety__label wa-link-safety__label--strong">{label}</p>
              {item.detail ? (
                <div className="wa-link-safety__engine-meta">
                  <span className="wa-link-safety__value-pill wa-link-safety__value-pill--error">
                    {item.detail}
                  </span>
                  {href ? (
                    <Link to={href} className="wa-link-safety__fix-btn" onClick={onNavigateAway}>
                      {t('whatsappLinkSafety.openSettings')}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </li>
      );
    }

    if (item.id === 'reconnectStability' && !item.ok && isEnvVarDetail(item.detail)) {
      return (
        <li key={item.id} className="wa-link-safety__item wa-link-safety__item--env">
          <div className="wa-link-safety__item-main wa-link-safety__item-main--stack">
            <div className="wa-link-safety__item-row">
              <MaterialSymbol name="terminal" size={20} />
              <span className="wa-link-safety__label">{label}</span>
            </div>
            <code className="wa-link-safety__code">{item.detail}</code>
          </div>
        </li>
      );
    }

    if (item.id === 'sessionProxy' && !item.ok) {
      return (
        <li key={item.id} className="wa-link-safety__item">
          <div className="wa-link-safety__item-main">
            <MaterialSymbol name="box" size={20} />
            <span className="wa-link-safety__label">{label}</span>
          </div>
          {href ? (
            <Link to={href} className="wa-link-safety__fix-btn" onClick={onNavigateAway}>
              {t('whatsappLinkSafety.openSettings')}
            </Link>
          ) : null}
        </li>
      );
    }

    const rowClass = [
      'wa-link-safety__item',
      item.ok ? 'is-ok' : item.severity === 'required' ? 'is-blocked' : 'is-warn',
      !item.ok && item.id === 'messageDelay' ? 'wa-link-safety__item--delay-warn' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const valuePill =
      item.detail && (item.id === 'dailySendLimit' || item.id === 'messageDelay') ? (
        <span
          className={`wa-link-safety__value-pill${
            !item.ok && item.id === 'messageDelay' ? ' wa-link-safety__value-pill--error' : ''
          }`}
        >
          {item.detail}
        </span>
      ) : null;

    return (
      <li key={item.id} className={rowClass}>
        <div className="wa-link-safety__item-main">
          {item.ok ? (
            <MaterialSymbol name="check_circle" size={20} filled className="wa-link-safety__ok-icon" />
          ) : (
            <MaterialSymbol name="warning" size={20} className="wa-link-safety__warn-icon" />
          )}
          <span className={`wa-link-safety__label${!item.ok ? ' wa-link-safety__label--strong' : ''}`}>
            {label}
          </span>
        </div>
        <div className="wa-link-safety__actions">
          {item.ok ? (
            <span className="wa-link-safety__passed">{t('whatsappLinkSafety.passed')}</span>
          ) : null}
          {valuePill}
          {toggleBinding ? (
            <label
              className={`wa-link-safety__toggle${isToggling ? ' is-busy' : ''}`}
              title={t('whatsappLinkSafety.toggleHint')}
            >
              <input
                type="checkbox"
                checked={toggleValue}
                disabled={isToggling || isFetching}
                onChange={e =>
                  void applyToggle(
                    item.id,
                    buildLinkPreflightTogglePatch(toggleBinding, e.target.checked) as Record<
                      string,
                      boolean
                    >,
                  )
                }
                aria-label={label}
              />
              <span className="wa-link-safety__toggle-slider" aria-hidden />
            </label>
          ) : null}
          {href && !toggleBinding && !item.ok && item.id !== 'enginePreference' ? (
            <Link to={href} className="wa-link-safety__fix-btn" onClick={onNavigateAway}>
              {t('whatsappLinkSafety.openSettings')}
            </Link>
          ) : null}
          {isToggling ? <Loader2 size={14} className="animate-spin wa-link-safety__spinner" /> : null}
        </div>
      </li>
    );
  };

  const renderAutoItem = (item: WhatsAppLinkPreflightItem, tier: 'required' | 'recommended') => {
    if (isModal) return renderModalItem(item, tier);

    const label = t(`whatsappLinkSafety.items.${item.id}`);
    const href = sessionId ? linkPreflightFixHref(item, sessionId) : null;
    const toggleBinding =
      safetySettings && isAdmin ? getLinkPreflightToggleBinding(item) : null;
    const toggleValue =
      toggleBinding && safetySettings
        ? readLinkPreflightToggleValue(toggleBinding, safetySettings)
        : false;
    const isToggling = fixingField === item.id;
    const tierClass = tier === 'required' ? 'is-required' : 'is-recommended';

    const rowClass = [
      'wa-link-safety__item',
      item.ok ? `is-ok ${tierClass}` : item.severity === 'required' ? '' : 'is-warn',
      embedded ? 'is-embedded' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const main = (
      <div className="wa-link-safety__item-main">
        {embedded ? (
          <span
            className={`wa-link-safety__icon${item.ok ? ` is-ok ${tierClass}` : ''}`}
            aria-hidden
          >
            {item.ok ? (
              tier === 'required' ? (
                <MaterialSymbol name="check_circle" size={20} filled />
              ) : (
                <MaterialSymbol name="check" size={20} />
              )
            ) : (
              <MaterialSymbol name="radio_button_unchecked" size={20} />
            )}
          </span>
        ) : (
          <span
            className={`wa-link-safety__mark${item.ok ? ` is-ok ${tierClass}` : ''}`}
            aria-hidden
          >
            {item.ok ? <Check size={14} strokeWidth={3} /> : null}
          </span>
        )}
        <span className="wa-link-safety__label">
          {label}
          {item.detail ? <span className="wa-link-safety__detail">{item.detail}</span> : null}
        </span>
      </div>
    );

    return (
      <li key={item.id} className={rowClass}>
        {main}
        <div className="wa-link-safety__actions">
          {toggleBinding ? (
            <label
              className={`wa-link-safety__toggle${isToggling ? ' is-busy' : ''}`}
              title={t('whatsappLinkSafety.toggleHint')}
            >
              <input
                type="checkbox"
                checked={toggleValue}
                disabled={isToggling || isFetching}
                onChange={e =>
                  void applyToggle(
                    item.id,
                    buildLinkPreflightTogglePatch(toggleBinding, e.target.checked) as Record<
                      string,
                      boolean
                    >,
                  )
                }
                aria-label={label}
              />
              <span className="wa-link-safety__toggle-slider" aria-hidden />
            </label>
          ) : null}
          {href && !toggleBinding ? (
            <Link to={href} className="wa-link-safety__fix-btn" onClick={onNavigateAway}>
              {t('whatsappLinkSafety.openSettings')}
            </Link>
          ) : null}
          {isToggling ? <Loader2 size={14} className="animate-spin wa-link-safety__spinner" /> : null}
        </div>
      </li>
    );
  };

  if (isLoading || !data) {
    return (
      <p className="wa-link-safety__hint">
        <Loader2 size={14} className="animate-spin" /> {t('whatsappLinkSafety.loading')}
      </p>
    );
  }

  const body = (
    <>
      {!embedded && (
        <section className={`wa-link-safety__summary${isModal ? ' wa-link-safety__summary--modal' : ''}`}>
          {isModal ? (
            <div className="wa-link-safety__summary-card">
              <div className="wa-link-safety__summary-icon" aria-hidden>
                <MaterialSymbol name="security" size={22} />
              </div>
              <div className="wa-link-safety__summary-body">
                <div className="wa-link-safety__summary-head">
                  <span className={`wa-link-safety__badge${data.ready ? ' is-ready' : ''}`}>
                    {data.ready
                      ? t('whatsappLinkSafety.statusReady')
                      : t('whatsappLinkSafety.statusReview')}
                  </span>
                  <span className="wa-link-safety__summary-progress-text">
                    {t('whatsappLinkSafety.progress', { completed: data.completed, total: data.total })}
                  </span>
                </div>
                <div className="wa-link-safety__progress-track" aria-hidden>
                  <div
                    className={`wa-link-safety__progress-fill${data.ready ? ' is-ready' : ''}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="wa-link-safety__summary-head">
                <h3 className="wa-link-safety__summary-label">{t('whatsappLinkSafety.statusLabel')}:</h3>
                <span className={`wa-link-safety__badge${data.ready ? ' is-ready' : ''}`}>
                  {data.ready ? t('whatsappLinkSafety.statusReady') : t('whatsappLinkSafety.statusReview')}
                </span>
              </div>
              <div className="wa-link-safety__summary-meta">
                <span>{t('whatsappLinkSafety.progress', { completed: data.completed, total: data.total })}</span>
                <span className="wa-link-safety__summary-dot" aria-hidden>
                  ·
                </span>
                <span className="wa-link-safety__engine-pill">{data.engineType}</span>
                {isFetching ? <Loader2 size={14} className="animate-spin" /> : null}
              </div>
            </>
          )}
        </section>
      )}

      {isModal && hint ? (
        <div className="wa-link-safety__info-banner">
          <MaterialSymbol name="info" size={20} filled className="wa-link-safety__info-icon" />
          <p>{hint}</p>
        </div>
      ) : hint && !isModal ? (
        <p className="wa-link-safety__hint">{hint}</p>
      ) : null}

      {!isModal && autoFixableCount > 0 ? (
        <div className="wa-link-safety__fix-all-row">
          <button
            type="button"
            className="wa-link-safety__fix-all-btn"
            disabled={fixingAll || isFetching}
            onClick={() => void fixAll()}
          >
            {fixingAll ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('whatsappLinkSafety.fixAll', { count: autoFixableCount })}
          </button>
        </div>
      ) : null}

      <section className="wa-link-safety__section">
        <h3 className="wa-link-safety__section-title">{t('whatsappLinkSafety.sections.required')}</h3>
        <ul className="wa-link-safety__list">
          {groups!.required.map(item => renderAutoItem(item, 'required'))}
        </ul>
      </section>

      <section className="wa-link-safety__section">
        <h3 className="wa-link-safety__section-title">{t('whatsappLinkSafety.sections.recommended')}</h3>
        <ul className="wa-link-safety__list">
          {groups!.recommended.map(item => renderAutoItem(item, 'recommended'))}
        </ul>
      </section>

      {mode === 'link' && !data.recommendedOk && !ackInFooter ? (
        <label className="wa-link-safety__ack">
          <input
            type="checkbox"
            checked={ackWarnings}
            onChange={e => setAckWarnings(e.target.checked)}
          />
          <span>{t('whatsappLinkSafety.ackWarnings')}</span>
        </label>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="wa-link-safety-checklist--embedded">{body}</div>;
  }

  return body;
}
