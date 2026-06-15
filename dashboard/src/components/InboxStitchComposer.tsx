import { useCallback, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComponentProps } from 'react';
import { MaterialSymbol } from './MaterialSymbol';
import type { InboxInteraktComposer } from './InboxInteraktChrome';

type InboxStitchComposerProps = ComponentProps<typeof InboxInteraktComposer> & {
  /** When stacked under AI suggestions, wrap controls in a card segment. */
  withAiPanel?: boolean;
};

const COMPOSER_MAX_HEIGHT_PX = 120;

export function InboxStitchComposer({
  canWrite,
  canSend,
  sending,
  draft,
  setDraft,
  onSend,
  composerInputRef,
  onComposerKeyDown,
  onAttachClick,
  onComposerContextMenu,
  withAiPanel = false,
}: InboxStitchComposerProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const hasDraft = draft.trim().length > 0;

  const syncComposerHeight = useCallback(() => {
    const el = composerInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const nextHeight = Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';

    const shell = el.closest('.inbox-stitch-composer__input-shell') as HTMLElement | null;
    if (!shell) return;

    const isMultiline = nextHeight > lineHeight + 1;
    shell.classList.toggle('inbox-stitch-composer__input-shell--expanded', isMultiline);

    if (isMultiline) {
      shell.style.height = '';
      shell.style.borderRadius = '';
      requestAnimationFrame(() => {
        shell.style.borderRadius = `${shell.offsetHeight / 2}px`;
      });
    } else {
      shell.style.height = '';
      shell.style.borderRadius = '';
    }
  }, [composerInputRef]);

  useLayoutEffect(() => {
    syncComposerHeight();
  }, [draft, syncComposerHeight]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend();
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    requestAnimationFrame(syncComposerHeight);
  };

  const row = (
    <div className="inbox-stitch-composer__row">
      <button
        type="button"
        className="inbox-stitch-composer__attach-btn"
        disabled={!canWrite || sending}
        title={t('inbox.attachImage')}
        aria-label={t('inbox.attachImage')}
        onMouseDown={e => e.preventDefault()}
        onClick={onAttachClick}
      >
        <MaterialSymbol name="add" size={22} className="inbox-stitch-composer__mat-icon" />
      </button>

      <div
        className={[
          'inbox-stitch-composer__input-shell',
          focused ? 'inbox-stitch-composer__input-shell--focused' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="inbox-stitch-composer__field-wrap">
          <textarea
            ref={composerInputRef}
            className="inbox-stitch-composer__field"
            rows={1}
            value={draft}
            onChange={e => handleDraftChange(e.target.value)}
            onKeyDown={onComposerKeyDown}
            onContextMenu={onComposerContextMenu}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('inbox.stitch.composerPlaceholder')}
            disabled={!canWrite || sending}
            aria-label={t('inbox.stitch.composerPlaceholder')}
            aria-multiline="true"
            spellCheck
          />
          <button
            type="button"
            className="inbox-stitch-composer__icon-btn inbox-stitch-composer__icon-btn--in-field inbox-stitch-composer__icon-btn--muted"
            disabled
            title={t('inbox.stitch.voiceComingSoonTitle')}
            aria-label={t('inbox.stitch.voiceComingSoonTitle')}
            onMouseDown={e => e.preventDefault()}
          >
            <MaterialSymbol name="mic" size={22} className="inbox-stitch-composer__mat-icon" />
          </button>
        </div>
      </div>

      <button
        type="submit"
        className="inbox-stitch-composer__send inbox-stitch-composer__send--outside"
        disabled={!canSend || sending || !hasDraft}
        aria-label={t('inbox.interakt.send')}
        onMouseDown={e => e.preventDefault()}
      >
        <MaterialSymbol name="arrow_upward" size={22} filled className="inbox-stitch-composer__send-icon" />
      </button>
    </div>
  );

  const cardClasses = [
    'inbox-stitch-composer__card',
    focused ? 'inbox-stitch-composer__card--focused' : '',
    hasDraft ? 'inbox-stitch-composer__card--has-draft' : '',
    !canWrite || sending ? 'inbox-stitch-composer__card--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <form
      className={[
        'inbox-stitch-composer',
        withAiPanel ? 'inbox-stitch-composer--with-ai' : 'inbox-stitch-composer--solo',
        !withAiPanel && focused ? 'inbox-stitch-composer--solo-focused' : '',
        !withAiPanel && hasDraft ? 'inbox-stitch-composer--solo-has-draft' : '',
        !withAiPanel && (!canWrite || sending) ? 'inbox-stitch-composer--solo-disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onSubmit={handleSubmit}
    >
      {withAiPanel ? <div className={cardClasses}>{row}</div> : row}
    </form>
  );
}
