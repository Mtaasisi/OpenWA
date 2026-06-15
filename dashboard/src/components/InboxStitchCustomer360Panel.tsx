import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxContactAvatar } from './InboxContactAvatar';
import { InboxContactPresenceDot } from './InboxContactPresenceDot';
import { InboxInteraktLeadSourceField } from './InboxInteraktLeadSourceField';
import { InboxStitchCustomerNotesPanel } from './InboxStitchCustomerNotesPanel';
import {
  InboxStitchGenderField,
  type StitchGenderValue,
} from './InboxStitchGenderField';
import { InboxStitchLocationField } from './InboxStitchLocationField';
import type { Conversation, InboxThreadCrm } from '../services/api';
import type { ConversationSource } from '../services/api';
import { isGroupChat } from '../pages/inbox-helpers';

interface Props {
  thread: { sessionId: string; chatId: string };
  conversation: Conversation;
  sessionStatus?: string;
  profileName: string;
  profilePhone: string | null;
  profileRegion: string;
  profileGenderValue: StitchGenderValue;
  onGenderChange?: (value: StitchGenderValue) => void;
  genderPending?: boolean;
  onLocationChange?: (region: string) => void;
  locationPending?: boolean;
  tags: string[];
  canWrite: boolean;
  onEditProfile: () => void;
  onAddTag: () => void;
  onBrowseCatalog: () => void;
  onSchedule: () => void;
  onPipeline: () => void;
  leadSource: ConversationSource;
  canEditLeadSource: boolean;
  leadSourcePending: boolean;
  onLeadSourceChange: (source: ConversationSource) => void;
  crm: InboxThreadCrm | undefined;
  groupMemberContext?: {
    groupTitle: string;
    messageCount: number;
  };
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  notesDirty: boolean;
  savingNotes: boolean;
  onSaveNotes: () => void;
  pinnedNote: boolean;
  setPinnedNote: (value: boolean) => void;
  customerNotesInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

export function InboxStitchCustomer360Panel({
  thread,
  conversation,
  sessionStatus,
  profileName,
  profilePhone,
  profileRegion,
  profileGenderValue,
  onGenderChange,
  genderPending = false,
  onLocationChange,
  locationPending = false,
  tags,
  canWrite,
  onEditProfile,
  onAddTag,
  onBrowseCatalog,
  onSchedule,
  onPipeline,
  leadSource,
  canEditLeadSource,
  leadSourcePending,
  onLeadSourceChange,
  crm,
  groupMemberContext,
  noteDraft,
  setNoteDraft,
  notesDirty,
  savingNotes,
  onSaveNotes,
  pinnedNote,
  setPinnedNote,
  customerNotesInputRef,
}: Props) {
  const { t } = useTranslation();
  const [tagsOpen, setTagsOpen] = useState(true);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const isGroup = isGroupChat(conversation.chatId);
  const effectiveSessionStatus = sessionStatus ?? conversation.sessionStatus;

  return (
    <section className="inbox-stitch-c360 animate-in">
      <div className="inbox-stitch-c360__scroll">
      <div className="inbox-stitch-c360-profile-card">
        <div className="inbox-stitch-c360-hero">
          <div className="inbox-stitch-c360-hero__avatar-wrap">
            <InboxContactAvatar
              sessionId={thread.sessionId}
              chatId={conversation.chatId}
              chatKind={isGroup ? 'group' : 'private'}
              title={profileName}
              profilePicUrl={conversation.profilePicUrl}
              sessionStatus={effectiveSessionStatus}
              className="inbox-stitch-c360-hero__avatar inbox-avatar"
              groupBadgePlacement="below"
            />
            {!isGroup ? (
              <InboxContactPresenceDot
                sessionId={thread.sessionId}
                chatId={conversation.chatId}
                sessionStatus={effectiveSessionStatus}
              />
            ) : null}
          </div>

          <div className="inbox-stitch-c360-hero__meta">
            <h3 className="inbox-stitch-c360-hero__name">{profileName}</h3>

            <div className="inbox-stitch-c360-fields">
              <div className="inbox-stitch-c360-field">
                <p className="inbox-stitch-c360-field__label">{t('inbox.stitch.gender')}</p>
                <InboxStitchGenderField
                  value={profileGenderValue}
                  canEdit={canWrite}
                  disabled={genderPending}
                  onChange={onGenderChange}
                />
              </div>
              <div className="inbox-stitch-c360-field">
                <p className="inbox-stitch-c360-field__label">{t('inbox.stitch.location')}</p>
                <InboxStitchLocationField
                  value={profileRegion}
                  canEdit={canWrite}
                  disabled={locationPending}
                  onChange={onLocationChange}
                />
              </div>
            </div>

            {groupMemberContext ? (
              <p className="inbox-stitch-c360-hero__context">
                {t('inbox.groupCrm.memberFromGroup', { group: groupMemberContext.groupTitle })}
                {' · '}
                {t('inbox.groupCrm.messageCount', { count: groupMemberContext.messageCount })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="inbox-stitch-c360-details">
          <div className="inbox-stitch-c360-details__head">
            <h4 className="inbox-stitch-c360-details__title">{t('inbox.interakt.profileDetails')}</h4>
            <button
              type="button"
              className="inbox-stitch-c360-details__edit"
              onClick={onEditProfile}
              title={t('inbox.interakt.edit')}
              aria-label={t('inbox.interakt.edit')}
            >
              <MaterialSymbol name="edit" size={16} />
            </button>
          </div>

          <dl className="inbox-stitch-c360-grid inbox-stitch-c360-details-grid--split">
            <div className="inbox-stitch-c360-grid__item">
              <dt>{t('leadSources.label')}</dt>
              <dd>
                <InboxInteraktLeadSourceField
                  className="inbox-interakt-lead-source--stitch"
                  source={leadSource}
                  canEdit={canEditLeadSource && canWrite}
                  disabled={leadSourcePending}
                  onChange={onLeadSourceChange}
                />
              </dd>
            </div>
            <div className="inbox-stitch-c360-grid__item">
              <dt>{t('inbox.stitch.phone')}</dt>
              <dd>{displayOrDash(profilePhone)}</dd>
            </div>
            {profileExpanded ? (
              <>
                <div className="inbox-stitch-c360-grid__item">
                  <dt>{t('inbox.crmSession')}</dt>
                  <dd title={conversation.sessionId}>{conversation.sessionName}</dd>
                </div>
                <div className="inbox-stitch-c360-grid__item">
                  <dt>{t('inbox.crmUnread')}</dt>
                  <dd>{conversation.unreadCount}</dd>
                </div>
                {crm?.linkedExternalId ? (
                  <div className="inbox-stitch-c360-grid__item inbox-stitch-c360-grid__item--wide">
                    <dt>{t('inbox.crmLinkedCustomer')}</dt>
                    <dd className="inbox-stitch-c360-grid__truncate">{crm.linkedExternalId}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
          </dl>

          <button
            type="button"
            className="inbox-stitch-c360-view-more"
            aria-expanded={profileExpanded}
            onClick={() => setProfileExpanded(v => !v)}
          >
            <span>{profileExpanded ? t('inbox.stitch.viewLess') : t('inbox.stitch.viewMore')}</span>
            <MaterialSymbol name={profileExpanded ? 'expand_less' : 'expand_more'} size={18} />
          </button>
        </div>
      </div>

      <div className={`inbox-stitch-c360-panel-card inbox-stitch-c360-tags-card${tagsOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="inbox-stitch-c360-panel-card__toggle"
          aria-expanded={tagsOpen}
          onClick={() => setTagsOpen(open => !open)}
        >
          <span className="inbox-stitch-c360-panel-card__title">{t('inbox.interakt.tagsLabel')}</span>
          <MaterialSymbol name={tagsOpen ? 'expand_more' : 'chevron_right'} size={20} />
        </button>
        {tagsOpen ? (
          <div className="inbox-stitch-c360-panel-card__body inbox-stitch-c360-tags">
            {tags.map(tag => (
              <button
                key={tag}
                type="button"
                className="inbox-stitch-c360-tags__pill"
                onClick={onEditProfile}
                title={t('inbox.stitch.editProfileTitle')}
              >
                {tag}
              </button>
            ))}
            {canWrite ? (
              <button
                type="button"
                className="inbox-stitch-c360-tags__add"
                onClick={onAddTag}
                title={t('inbox.interakt.addTag')}
                aria-label={t('inbox.interakt.addTag')}
              >
                <MaterialSymbol name="add" size={20} />
              </button>
            ) : null}
            {tags.length === 0 ? (
              <p className="inbox-stitch-c360-tags__empty">{t('inbox.interakt.tagsEmpty')}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <InboxStitchCustomerNotesPanel
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        notesDirty={notesDirty}
        canWrite={canWrite}
        savingNotes={savingNotes}
        onSaveNotes={onSaveNotes}
        pinnedNote={pinnedNote}
        setPinnedNote={setPinnedNote}
        customerNotesInputRef={customerNotesInputRef}
      />
      </div>

      <div className="inbox-stitch-c360-panel-card inbox-stitch-c360-quick-actions-card">
        <h4 className="inbox-stitch-c360-panel-card__title inbox-stitch-c360-panel-card__title--static">
          {t('inbox.interakt.quickActions')}
        </h4>
        <div className="inbox-stitch-c360-panel-card__body inbox-stitch-c360-quick-actions">
          <button type="button" className="inbox-stitch-c360-quick-actions__btn" onClick={onAddTag}>
            <MaterialSymbol name="add" size={14} weight={400} className="inbox-stitch-c360-quick-actions__icon" />
            <span className="inbox-stitch-c360-quick-actions__label">{t('inbox.stitch.quickAddTag')}</span>
          </button>
          <button type="button" className="inbox-stitch-c360-quick-actions__btn" onClick={onBrowseCatalog}>
            <MaterialSymbol name="inventory_2" size={14} weight={400} className="inbox-stitch-c360-quick-actions__icon" />
            <span className="inbox-stitch-c360-quick-actions__label">{t('inbox.stitch.quickCatalog')}</span>
          </button>
          <button type="button" className="inbox-stitch-c360-quick-actions__btn" onClick={onSchedule}>
            <MaterialSymbol name="calendar_today" size={14} weight={400} className="inbox-stitch-c360-quick-actions__icon" />
            <span className="inbox-stitch-c360-quick-actions__label">{t('inbox.stitch.schedule')}</span>
          </button>
          <button type="button" className="inbox-stitch-c360-quick-actions__btn" onClick={onPipeline}>
            <MaterialSymbol name="account_tree" size={14} weight={400} className="inbox-stitch-c360-quick-actions__icon" />
            <span className="inbox-stitch-c360-quick-actions__label">{t('inbox.stitch.quickPipeline')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
