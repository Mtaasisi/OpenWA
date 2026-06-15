import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import type { Session, SessionHealthOverview } from '../../services/api';
import { SessionsStatusPills } from '../SessionsStatusPills';
import { ChannelSessionCard } from './ChannelSessionCard';
import {
  ChannelSessionDetailPanel,
  ChannelDetailEmpty,
} from './ChannelSessionDetailPanel';
import type { SessionQrModalState } from '../SessionQrModal';
import type { WhatsAppLinkPreflightSummaryRow } from '../../services/api';
import { EmptyState } from '../workspace';
import { isSessionHealthHealthy } from '../../lib/session-health-utils';
import { sessionNeedsLink } from '../../lib/session-link.util';

type EngineOption = { id: string; name: string };

export type ChannelsWorkspaceProps = {
  sessions: Session[];
  filteredSessions: Session[];
  listExtras?: ReactNode;
  error?: string | null;
  canWrite: boolean;
  hideCreateActions?: boolean;
  onAddChannelClick?: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  healthOverview: SessionHealthOverview[];
  linkSafetySessions?: Array<{ sessionId: string; ready: boolean }>;
  linkSafetyBySessionId: Map<string, WhatsAppLinkPreflightSummaryRow>;
  healthBySessionId: Map<string, SessionHealthOverview>;
  unreadMap: Record<string, number>;
  failedBySession: Record<string, number>;
  selectedSessionId?: string | null;
  focusSessionId?: string | null;
  externalDetailPane?: ReactNode;
  paneSession: Session | null;
  isMobile?: boolean;
  mobilePane?: 'list' | 'detail';
  onMobileShowDetail?: () => void;
  onMobileBack?: () => void;
  onSessionSelect?: (sessionId: string | null) => void;
  onDismissInspector?: () => void;
  getHealthIssueMessage: (sessionId: string) => string | null;
  relinkingId: string | null;
  starting: boolean;
  formatLastActive: (date?: string) => string;
  handleShowQR: (sessionId: string) => void;
  engines: EngineOption[];
  currentEngineId: string;
  currentEngineLabel: string;
  proxyUrlText: string;
  proxyType: 'http' | 'https' | 'socks4' | 'socks5';
  staffAiNumbersText: string;
  savingAiAutoReply: boolean;
  savingFollowupAutopilot: boolean;
  savingProxy: boolean;
  savingStaffAi: boolean;
  formatStatus: (status: string) => string;
  showRequiresRelinkBanner: (session: Session) => boolean;
  sessionRequiresRelinkMessageKey: (session: Pick<Session, 'relinkReason'>) => string;
  qrModal: SessionQrModalState | null;
  retrySessionFlow: (sessionId: string, sessions: Session[]) => void;
  continueQrInBackground: () => void;
  setProxyUrlText: (v: string) => void;
  setProxyType: (v: 'http' | 'https' | 'socks4' | 'socks5') => void;
  setStaffAiNumbersText: (v: string) => void;
  handleAiAutoReplyToggle: (session: Session, enabled: boolean) => void;
  handleFollowupAutopilotToggle: (session: Session, enabled: boolean) => void;
  handleSaveProxy: () => void;
  handleSaveStaffAiNumbers: () => void;
  handleSaveAllSettings: () => void;
  handleRelink: (session: Session) => void;
  setForceRelinkConfirmId: (id: string) => void;
  setDeleteConfirmId: (id: string) => void;
  handleRestart: (sessionId: string) => void;
  handleStop: (sessionId: string) => void;
  canForceRelinkSession: (session: Session) => boolean;
  canRestartSession: (session: Session) => boolean;
  openCreate: () => void;
  extraChannelCount?: number;
  lastRefreshedAt?: number;
};

export function ChannelsWorkspace(props: ChannelsWorkspaceProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    sessions,
    filteredSessions,
    listExtras,
    error,
    canWrite,
    hideCreateActions,
    onAddChannelClick,
    onRefresh,
    refreshing = false,
    searchQuery,
    onSearchQueryChange,
    statusFilter,
    onStatusFilterChange,
    healthOverview,
    linkSafetySessions,
    linkSafetyBySessionId,
    healthBySessionId,
    unreadMap,
    failedBySession,
    selectedSessionId,
    focusSessionId,
    externalDetailPane,
    paneSession,
    isMobile,
    mobilePane,
    onMobileShowDetail,
    onMobileBack,
    onSessionSelect,
    onDismissInspector,
    getHealthIssueMessage,
    relinkingId,
    starting,
    formatLastActive,
    handleShowQR,
    engines,
    currentEngineId,
    currentEngineLabel,
    proxyUrlText,
    proxyType,
    savingAiAutoReply,
    savingFollowupAutopilot,
    savingProxy,
    savingStaffAi,
    formatStatus,
    showRequiresRelinkBanner,
    sessionRequiresRelinkMessageKey,
    setProxyUrlText,
    setProxyType,
    handleAiAutoReplyToggle,
    handleFollowupAutopilotToggle,
    handleSaveAllSettings,
    handleRelink,
    setForceRelinkConfirmId,
    setDeleteConfirmId,
    handleRestart,
    handleStop,
    canForceRelinkSession,
    canRestartSession,
    openCreate,
    extraChannelCount = 0,
  } = props;

  const tabs = [
    { id: 'all', label: t('sessions.filter.all') },
    { id: 'active', label: t('sessions.filter.active') },
    { id: 'inactive', label: t('sessions.filter.inactive') },
    { id: 'connecting', label: t('sessions.filter.connecting') },
  ] as const;

  const trimmedSearch = searchQuery.trim();
  const hasVisibleExtras = extraChannelCount > 0;
  const showCreateEmpty =
    filteredSessions.length === 0 && !hasVisibleExtras && sessions.length === 0;
  const showSearchEmpty =
    filteredSessions.length === 0 &&
    !hasVisibleExtras &&
    sessions.length > 0 &&
    trimmedSearch.length > 0;
  const showFilterEmpty =
    filteredSessions.length === 0 &&
    !hasVisibleExtras &&
    sessions.length > 0 &&
    trimmedSearch.length === 0 &&
    statusFilter !== 'all';

  const sessionIds = filteredSessions.map(s => s.id);

  const moveSelection = useCallback(
    (delta: number) => {
      if (sessionIds.length === 0) return;
      const currentIdx = selectedSessionId ? sessionIds.indexOf(selectedSessionId) : -1;
      const nextIdx =
        currentIdx < 0
          ? delta > 0
            ? 0
            : sessionIds.length - 1
          : (currentIdx + delta + sessionIds.length) % sessionIds.length;
      const nextId = sessionIds[nextIdx];
      onSessionSelect?.(nextId);
      onMobileShowDetail?.();
      requestAnimationFrame(() => {
        document.getElementById(`session-card-${nextId}`)?.focus();
      });
    },
    [onSessionSelect, selectedSessionId, sessionIds],
  );

  const focusFirstNeedsRelink = useCallback(() => {
    onStatusFilterChange('inactive');
    const target =
      sessions.find(s => s.requiresRelink) ??
      sessions.find(s => s.status === 'failed' || s.status === 'disconnected');
    if (target) {
      onSessionSelect?.(target.id);
      onMobileShowDetail?.();
      requestAnimationFrame(() => {
        document.getElementById(`session-card-${target.id}`)?.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [onMobileShowDetail, onSessionSelect, onStatusFilterChange, sessions]);

  const focusFirstHealthIssue = useCallback(() => {
    const target = sessions.find(s => {
      const entry = healthBySessionId.get(s.id);
      return entry && !isSessionHealthHealthy(entry);
    });
    if (target) {
      onSessionSelect?.(target.id);
      onMobileShowDetail?.();
      requestAnimationFrame(() => {
        document.getElementById(`session-card-${target.id}`)?.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [healthBySessionId, onMobileShowDetail, onSessionSelect, sessions]);

  const focusFirstLinkSafety = useCallback(() => {
    onStatusFilterChange('all');
    const target = sessions.find(s => {
      const row = linkSafetyBySessionId.get(s.id);
      return row && sessionNeedsLink(s) && !row.ready;
    });
    if (target) {
      onSessionSelect?.(target.id);
      onMobileShowDetail?.();
      requestAnimationFrame(() => {
        document.getElementById(`session-card-${target.id}`)?.scrollIntoView({ block: 'nearest' });
      });
    }
  }, [linkSafetyBySessionId, onMobileShowDetail, onSessionSelect, onStatusFilterChange, sessions]);

  const visibleChannelCount = filteredSessions.length + extraChannelCount;

  const tablistRef = useRef<HTMLDivElement>(null);

  const clearFilters = useCallback(() => {
    onStatusFilterChange('all');
    onSearchQueryChange('');
    searchRef.current?.focus();
  }, [onSearchQueryChange, onStatusFilterChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!['1', '2', '3', '4'].includes(e.key)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const tab = tabs[Number(e.key) - 1];
      if (tab) onStatusFilterChange(tab.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStatusFilterChange, tabs]);

  useEffect(() => {
    if (isMobile || !onDismissInspector) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (selectedSessionId || paneSession)) {
        onDismissInspector();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, onDismissInspector, selectedSessionId, paneSession]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      onRefresh();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onRefresh]);

  useEffect(() => {
    if (!canWrite) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'q' && e.key !== 'Q') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!selectedSessionId) return;
      e.preventDefault();
      onSessionSelect?.(selectedSessionId);
      onMobileShowDetail?.();
      handleShowQR(selectedSessionId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canWrite, handleShowQR, onMobileShowDetail, onSessionSelect, selectedSessionId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'i' && e.key !== 'I') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!selectedSessionId) return;
      const session = sessions.find(s => s.id === selectedSessionId);
      if (!session || session.status !== 'ready' || session.requiresRelink) return;
      e.preventDefault();
      navigate(`/inbox?session=${encodeURIComponent(selectedSessionId)}`);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, selectedSessionId, sessions]);

  useEffect(() => {
    if (!canWrite) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      if (hideCreateActions && onAddChannelClick) onAddChannelClick();
      else openCreate();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canWrite, hideCreateActions, onAddChannelClick, openCreate]);

  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.cc-grid')) return;
      if (target.closest('input, textarea, select, button')) return;
      e.preventDefault();
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') moveSelection(1);
      else moveSelection(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, moveSelection]);

  return (
    <div
      className={[
        'cc-shell',
        isMobile ? 'cc-shell--mobile' : '',
        isMobile && mobilePane === 'list' ? 'cc-shell--show-main' : '',
        isMobile && mobilePane === 'detail' ? 'cc-shell--show-inspector' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="cc-main-col">
        <header className="cc-topbar">
          <div className="cc-search">
            <MaterialSymbol name="search" size={18} className="cc-search__icon" />
            <input
              ref={searchRef}
              type="search"
              className="cc-search__input"
              value={searchQuery}
              onChange={e => onSearchQueryChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && searchQuery) {
                  e.preventDefault();
                  onSearchQueryChange('');
                }
              }}
              placeholder={t('channels.searchPlaceholder')}
              aria-label={t('channels.searchPlaceholder')}
            />
            {trimmedSearch ? (
              <button
                type="button"
                className="cc-search__clear"
                onClick={() => {
                  onSearchQueryChange('');
                  searchRef.current?.focus();
                }}
                aria-label={t('common.clear', { defaultValue: 'Clear' })}
              >
                <MaterialSymbol name="close" size={16} />
              </button>
            ) : null}
          </div>
        </header>

        <main className={`cc-scroll${refreshing ? ' cc-scroll--refreshing' : ''}`}>
          <div className="cc-head">
            <div>
              <h2 className="cc-head__title">{t('channels.pageTitle')}</h2>
              <p className="cc-head__subtitle">{t('channels.pageDescription')}</p>
            </div>
            <button
              type="button"
              className={`cc-head__refresh${refreshing ? ' cc-head__refresh--spinning' : ''}`}
              onClick={onRefresh}
              disabled={refreshing}
            >
              <MaterialSymbol name="refresh" size={20} />
              {t('common.refresh')}
            </button>
          </div>

          <div
            ref={tablistRef}
            className="cc-tabs cc-tabs--scroll"
            role="tablist"
            aria-label={t('channels.pageTitle')}
            onKeyDown={e => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const idx = tabs.findIndex(tab => tab.id === statusFilter);
              const nextIdx =
                e.key === 'ArrowRight'
                  ? (idx + 1) % tabs.length
                  : (idx - 1 + tabs.length) % tabs.length;
              const nextTab = tabs[nextIdx];
              onStatusFilterChange(nextTab.id);
              requestAnimationFrame(() => {
                document.getElementById(`cc-tab-${nextTab.id}`)?.focus();
              });
            }}
          >
            {tabs.map(tab => (
              <button
                key={tab.id}
                id={`cc-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.id}
                aria-controls="cc-channel-grid"
                className={`cc-tabs__btn${statusFilter === tab.id ? ' cc-tabs__btn--active' : ''}`}
                onClick={() => onStatusFilterChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="cc-sr-only" aria-live="polite" aria-atomic="true">
            {t('channels.resultsCount', {
              count: visibleChannelCount,
              defaultValue: '{{count}} channels shown',
            })}
          </p>

          {error ? <div className="ws-inline-error">{error}</div> : null}

          <SessionsStatusPills
            variant="cards"
            sessions={sessions}
            healthOverview={healthOverview}
            linkSafetySessions={linkSafetySessions}
            onRelinkAlert={focusFirstNeedsRelink}
            onHealthAlert={focusFirstHealthIssue}
            onLinkSafetyAlert={focusFirstLinkSafety}
          />

          <div
            id="cc-channel-grid"
            className="cc-grid"
            role="listbox"
            aria-labelledby={`cc-tab-${statusFilter}`}
            aria-label={t('channels.pageTitle')}
          >
            {showCreateEmpty ? (
              <div className="cc-grid__empty">
                <EmptyState
                  icon={<MaterialSymbol name="qr_code_scanner" size={40} />}
                  title={t('sessions.empty.title')}
                  description={t('sessions.empty.description')}
                  action={
                    canWrite ? (
                      <button
                        type="button"
                        className="fu-btn fu-btn--primary"
                        onClick={hideCreateActions && onAddChannelClick ? onAddChannelClick : openCreate}
                      >
                        <MaterialSymbol name="add" size={16} />
                        {hideCreateActions && onAddChannelClick
                          ? t('channels.addChannel')
                          : t('sessions.newSession')}
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : showSearchEmpty ? (
              <div className="cc-grid__empty cc-grid__hint">
                <p>{t('channels.noSearchResults')}</p>
                <button type="button" className="cc-grid__reset" onClick={clearFilters}>
                  {t('channels.clearFilters')}
                </button>
              </div>
            ) : showFilterEmpty ? (
              <div className="cc-grid__empty cc-grid__hint">
                <p>{t('channels.noFilterResults')}</p>
                <button type="button" className="cc-grid__reset" onClick={clearFilters}>
                  {t('channels.clearFilters')}
                </button>
              </div>
            ) : (
              <>
                {filteredSessions.map(session => {
                  const healthIssueMessage =
                    session.status !== 'failed' && !session.requiresRelink
                      ? getHealthIssueMessage(session.id)
                      : null;
                  const linkSafetyRow = linkSafetyBySessionId.get(session.id);
                  return (
                    <ChannelSessionCard
                      key={session.id}
                      session={session}
                      selected={selectedSessionId === session.id && !externalDetailPane}
                      focused={focusSessionId === session.id}
                      canWrite={canWrite}
                      healthIssueMessage={healthIssueMessage}
                      linkSafetyRow={linkSafetyRow}
                      unreadCount={unreadMap[session.id] ?? 0}
                      failedCount={failedBySession[session.id] ?? 0}
                      isRelinking={relinkingId === session.id}
                      starting={starting}
                      formatLastActive={formatLastActive}
                      onSelect={() => {
                        onSessionSelect?.(session.id);
                        onMobileShowDetail?.();
                        requestAnimationFrame(() => {
                          document.getElementById(`session-card-${session.id}`)?.focus();
                        });
                      }}
                      onScanQr={() => {
                        onSessionSelect?.(session.id);
                        onMobileShowDetail?.();
                        handleShowQR(session.id);
                      }}
                      onOpenInbox={() => {
                        navigate(`/inbox?session=${encodeURIComponent(session.id)}`);
                      }}
                    />
                  );
                })}
                {listExtras}
              </>
            )}
          </div>
        </main>
      </div>

      <aside className={`cc-inspector${!externalDetailPane && !paneSession ? ' cc-inspector--empty' : ''}`}>
        {externalDetailPane ??
          (paneSession ? (
            <ChannelSessionDetailPanel
              session={paneSession}
              canWrite={canWrite}
              engines={engines}
              currentEngineId={currentEngineId}
              currentEngineLabel={currentEngineLabel}
              healthEntry={healthBySessionId.get(paneSession.id)}
              linkSafetyRow={linkSafetyBySessionId.get(paneSession.id)}
              proxyUrlText={proxyUrlText}
              proxyType={proxyType}
              onProxyUrlChange={setProxyUrlText}
              onProxyTypeChange={setProxyType}
              savingAiAutoReply={savingAiAutoReply}
              savingFollowupAutopilot={savingFollowupAutopilot}
              savingProxy={savingProxy}
              savingStaffAi={savingStaffAi}
              relinkingId={relinkingId}
              formatStatus={formatStatus}
              showRelinkBanner={showRequiresRelinkBanner(paneSession)}
              relinkMessageKey={sessionRequiresRelinkMessageKey(paneSession)}
              showBack={isMobile}
              onBack={onMobileBack}
              onClose={!isMobile ? onDismissInspector : undefined}
              onProxyToggle={enabled => {
                if (!enabled) setProxyUrlText('');
              }}
              onAiAutoReplyToggle={enabled => handleAiAutoReplyToggle(paneSession, enabled)}
              onFollowupAutopilotToggle={enabled =>
                handleFollowupAutopilotToggle(paneSession, enabled)
              }
              onSaveAll={() => void handleSaveAllSettings()}
              onRelink={() => handleRelink(paneSession)}
              onForceRelink={() => setForceRelinkConfirmId(paneSession.id)}
              onScanQrFlow={() => handleShowQR(paneSession.id)}
              onDelete={() => setDeleteConfirmId(paneSession.id)}
              onRestart={() => handleRestart(paneSession.id)}
              onStop={() => void handleStop(paneSession.id)}
              canForceRelink={canForceRelinkSession(paneSession)}
              canRestart={canRestartSession(paneSession)}
            />
          ) : (
            <ChannelDetailEmpty message={t('channels.selectChannel')} />
          ))}
      </aside>
    </div>
  );
}
