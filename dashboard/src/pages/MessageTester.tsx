import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { messageApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery, useSessionGroupsQuery } from '../hooks/queries';
import { WorkspacePageHeader, StatusBadge } from '../components/workspace';
import './MessageTester.css';

interface ApiResponse {
  success: boolean;
  messageId?: string;
  timestamp: string;
  error?: string;
}

const messageTypes = ['text', 'image', 'video', 'audio', 'document'] as const;

export function MessageTester({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  useDocumentTitle(embedded ? t('settings.title') : t('messageTester.title'));
  const { canWrite } = useRole();
  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter(s => s.status === 'ready');
  const [session, setSession] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState<'personal' | 'group'>('personal');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [messageType, setMessageType] = useState<(typeof messageTypes)[number]>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const { data: groups = [], isLoading: loadingGroups } = useSessionGroupsQuery(
    session,
    recipientType === 'group',
  );

  useEffect(() => {
    if (sessions.length > 0 && !session) {
      setSession(sessions[0].id);
    }
  }, [sessions, session]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id);
    }
    if (recipientType !== 'group') {
      setSelectedGroup('');
    }
  }, [groups, selectedGroup, recipientType]);

  const handleSend = async () => {
    const targetId = recipientType === 'group' ? selectedGroup : recipient;
    if (!session || !targetId) return;
    setIsLoading(true);
    setResponse(null);

    const chatId = recipientType === 'group' ? targetId : recipient.replace(/[^0-9]/g, '') + '@c.us';

    try {
      let result;
      if (messageType === 'text') {
        result = await messageApi.sendText(session, chatId, content);
      } else if (messageType === 'image') {
        result = await messageApi.sendImage(session, chatId, mediaUrl, content);
      } else if (messageType === 'video') {
        result = await messageApi.sendVideo(session, chatId, mediaUrl, content);
      } else if (messageType === 'audio') {
        result = await messageApi.sendAudio(session, chatId, mediaUrl);
      } else {
        result = await messageApi.sendDocument(session, chatId, mediaUrl, content);
      }

      setResponse({
        success: !!result.messageId,
        messageId: result.messageId,
        timestamp: result.timestamp ? new Date(result.timestamp * 1000).toISOString() : new Date().toISOString(),
      });
    } catch (err) {
      setResponse({
        success: false,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : t('messageTester.sendFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const body = loadingSessions ? (
    <div className="message-tester-interakt__loading">
      <Loader2 className="animate-spin" size={28} />
    </div>
  ) : (
    <div className="message-tester-interakt__grid">
      <section className="fu-glass-card message-tester-interakt__panel">
        <h3 className="message-tester-interakt__title">{t('messageTester.compose')}</h3>

        <div className="message-tester-interakt__field">
          <label>{t('messageTester.session')}</label>
          <select className="message-tester-interakt__input" value={session} onChange={e => setSession(e.target.value)}>
            {sessions.length === 0 && <option value="">{t('messageTester.noReadySessions')}</option>}
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.phone || t('messageTester.sessionOptionPhoneNone')})
              </option>
            ))}
          </select>
        </div>

        <div className="message-tester-interakt__field">
          <label>{t('messageTester.recipientType')}</label>
          <div className="fu-chips" role="group">
            {(['personal', 'group'] as const).map(type => (
              <button
                key={type}
                type="button"
                className={['fu-chip', recipientType === type ? 'fu-chip--active' : ''].join(' ')}
                onClick={() => setRecipientType(type)}
              >
                {t(`messageTester.${type}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="message-tester-interakt__field">
          <label>{recipientType === 'group' ? t('messageTester.selectGroup') : t('messageTester.recipientPhone')}</label>
          {recipientType === 'group' ? (
            <>
              <select
                className="message-tester-interakt__input"
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                disabled={loadingGroups || groups.length === 0}
              >
                {loadingGroups && <option value="">{t('messageTester.loadingGroups')}</option>}
                {!loadingGroups && groups.length === 0 && <option value="">{t('messageTester.noGroupsFound')}</option>}
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <span className="message-tester-interakt__hint">{t('messageTester.selectGroupHint')}</span>
            </>
          ) : (
            <>
              <input
                className="message-tester-interakt__input"
                type="text"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                placeholder="+62812345678"
              />
              <span className="message-tester-interakt__hint">{t('messageTester.phoneHint')}</span>
            </>
          )}
        </div>

        <div className="message-tester-interakt__field">
          <label>{t('messageTester.messageType')}</label>
          <div className="fu-chips message-tester-interakt__type-chips" role="group">
            {messageTypes.map(type => (
              <button
                key={type}
                type="button"
                className={['fu-chip', messageType === type ? 'fu-chip--active' : ''].join(' ')}
                onClick={() => setMessageType(type)}
              >
                {t(`messageTester.types.${type}`)}
              </button>
            ))}
          </div>
        </div>

        {messageType === 'text' ? (
          <div className="message-tester-interakt__field">
            <label>{t('messageTester.messageContent')}</label>
            <textarea
              className="message-tester-interakt__input message-tester-interakt__textarea"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t('messageTester.messagePlaceholder')}
              rows={5}
            />
          </div>
        ) : (
          <>
            <div className="message-tester-interakt__field">
              <label>{t('messageTester.mediaUrl')}</label>
              <input
                className="message-tester-interakt__input"
                type="text"
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder="https://example.com/file.jpg"
              />
            </div>
            {messageType !== 'audio' && (
              <div className="message-tester-interakt__field">
                <label>
                  {messageType === 'document' ? t('messageTester.filename') : t('messageTester.caption')} (
                  {t('common.optional')})
                </label>
                <input
                  className="message-tester-interakt__input"
                  type="text"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={
                    messageType === 'document'
                      ? t('messageTester.filenamePlaceholder')
                      : t('messageTester.captionPlaceholder')
                  }
                />
              </div>
            )}
          </>
        )}

        <button
          type="button"
          className="fu-btn fu-btn--primary message-tester-interakt__send"
          onClick={handleSend}
          disabled={!canWrite || isLoading || !session || (recipientType === 'group' ? !selectedGroup : !recipient)}
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          {isLoading ? t('messageTester.sending') : canWrite ? t('messageTester.send') : t('messageTester.viewOnly')}
        </button>
      </section>

      <section className="fu-glass-card message-tester-interakt__panel">
        <h3 className="message-tester-interakt__title">{t('messageTester.responseTitle')}</h3>

        {response ? (
          <>
            <div className="message-tester-interakt__status">
              <StatusBadge variant={response.success ? 'success' : 'error'}>
                {response.success ? (
                  <>
                    <CheckCircle size={14} />
                    {t('messageTester.successLabel')}
                  </>
                ) : (
                  <>
                    <XCircle size={14} />
                    {t('messageTester.failedLabel')}
                  </>
                )}
              </StatusBadge>
            </div>

            <dl className="message-tester-interakt__details">
              <div>
                <dt>{t('messageTester.response.timestamp')}</dt>
                <dd>{response.timestamp}</dd>
              </div>
              {response.messageId && (
                <div>
                  <dt>{t('messageTester.response.messageId')}</dt>
                  <dd className="message-tester-interakt__mono">{response.messageId}</dd>
                </div>
              )}
              {response.error && (
                <div>
                  <dt>{t('messageTester.response.error')}</dt>
                  <dd className="message-tester-interakt__error">{response.error}</dd>
                </div>
              )}
            </dl>

            <pre className="message-tester-interakt__json">{JSON.stringify(response, null, 2)}</pre>
          </>
        ) : (
          <div className="message-tester-interakt__empty">
            <p>{t('messageTester.responseEmpty')}</p>
          </div>
        )}
      </section>
    </div>
  );

  if (embedded) {
    return <div className="message-tester-interakt message-tester-interakt--embed">{body}</div>;
  }

  return (
    <div className="followups-interakt message-tester-interakt">
      <WorkspacePageHeader
        title={t('messageTester.title')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
      />
      <div className="followups-interakt__scroll">{body}</div>
    </div>
  );
}
