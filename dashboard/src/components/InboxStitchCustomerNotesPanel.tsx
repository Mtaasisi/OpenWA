import { useTranslation } from 'react-i18next';

interface Props {
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  notesDirty: boolean;
  canWrite: boolean;
  savingNotes: boolean;
  onSaveNotes: () => void;
  pinnedNote: boolean;
  setPinnedNote: (value: boolean) => void;
  customerNotesInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function InboxStitchCustomerNotesPanel({
  noteDraft,
  setNoteDraft,
  notesDirty,
  canWrite,
  savingNotes,
  onSaveNotes,
  pinnedNote,
  setPinnedNote,
  customerNotesInputRef,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="inbox-stitch-c360-panel-card inbox-stitch-c360-notes-card">
      <h4 className="inbox-stitch-c360-panel-card__title inbox-stitch-c360-panel-card__title--static">
        {t('inbox.interakt.customerNotes')}
      </h4>
      <div className="inbox-stitch-c360-panel-card__body inbox-stitch-c360-notes">
        <textarea
          ref={customerNotesInputRef}
          className="inbox-stitch-c360-notes__field"
          rows={4}
          value={noteDraft}
          onChange={e => setNoteDraft(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && notesDirty && canWrite) {
              e.preventDefault();
              onSaveNotes();
            }
          }}
          placeholder={t('inbox.stitch.customerNotesPlaceholder')}
          disabled={!canWrite || savingNotes}
          aria-label={t('inbox.interakt.customerNotes')}
        />
        <div className="inbox-stitch-c360-notes__footer">
          <label className="inbox-stitch-c360-notes__pinned">
            <input
              type="checkbox"
              checked={pinnedNote}
              onChange={e => setPinnedNote(e.target.checked)}
              disabled={!canWrite}
            />
            <span>{t('inbox.interakt.pinnedForAgents')}</span>
          </label>
          <button
            type="button"
            className="inbox-stitch-c360-notes__save"
            disabled={!canWrite || !notesDirty || savingNotes}
            onClick={onSaveNotes}
          >
            {savingNotes ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
