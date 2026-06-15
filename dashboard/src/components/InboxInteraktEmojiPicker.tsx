import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';

interface EmojiSelectPayload {
  native: string;
}

interface EmojiMartPickerProps {
  data: unknown;
  onEmojiSelect: (emoji: EmojiSelectPayload) => void;
  theme?: 'light' | 'dark' | 'auto';
  locale?: string;
  categories?: string[];
  previewPosition?: 'top' | 'bottom' | 'none';
  skinTonePosition?: 'preview' | 'search' | 'none';
  navPosition?: 'top' | 'bottom' | 'none';
  searchPosition?: 'sticky' | 'static' | 'none';
  maxFrequentRows?: number;
  perLine?: number;
  emojiSize?: number;
  emojiButtonSize?: number;
  dynamicWidth?: boolean;
  icons?: 'auto' | 'outline' | 'solid';
}

/** WhatsApp Web category order (icons in bottom nav). */
const EMOJI_CATEGORIES = [
  'frequent',
  'people',
  'nature',
  'foods',
  'activity',
  'places',
  'objects',
  'symbols',
  'flags',
];

const POPOVER_WIDTH = 352;
/** Match emoji-mart default picker height so bottom category tabs are not clipped. */
const POPOVER_HEIGHT = 452;
const VIEWPORT_MARGIN = 8;

function emojiMartLocale(language: string): string {
  const code = language.split('-')[0]?.toLowerCase() ?? 'en';
  const supported = new Set([
    'ar', 'be', 'cs', 'de', 'en', 'es', 'fa', 'fi', 'fr', 'hi', 'it', 'ja', 'ko',
    'nl', 'pl', 'pt', 'ru', 'sa', 'tr', 'uk', 'vi', 'zh',
  ]);
  return supported.has(code) ? code : 'en';
}

interface Props {
  canWrite: boolean;
  buttonClassName?: string;
  onInsert: (emoji: string) => void;
  onFocusComposer?: () => void;
}

export function InboxInteraktEmojiPicker({
  canWrite,
  buttonClassName = 'inbox-interakt-tool-btn',
  onInsert,
  onFocusComposer,
}: Props) {
  const { t, i18n } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<{ bottom: number; left: number } | null>(null);
  const [Picker, setPicker] = useState<ComponentType<EmojiMartPickerProps> | null>(null);
  const [emojiData, setEmojiData] = useState<unknown>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    let left = rect.right - POPOVER_WIDTH;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN),
    );
    const bottom = window.innerHeight - rect.top + VIEWPORT_MARGIN;
    setPosition({ bottom, left });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([import('@emoji-mart/data'), import('@emoji-mart/react')])
      .then(([dataMod, pickerMod]) => {
        if (cancelled) return;
        setEmojiData(dataMod.default);
        setPicker(() => pickerMod.default as ComponentType<EmojiMartPickerProps>);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const insertEmoji = (emoji: string) => {
    onInsert(emoji);
    onFocusComposer?.();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={buttonClassName}
        disabled={!canWrite}
        title={t('inbox.interakt.toolEmoji')}
        aria-label={t('inbox.interakt.toolEmoji')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <MaterialSymbol name="mood" size={18} />
      </button>

      {open &&
        createPortal(
          <>
            <div
              className="inbox-interakt-emoji-backdrop"
              onClick={() => setOpen(false)}
              role="presentation"
            />
            {position && (
              <div
                className="inbox-interakt-emoji-popover"
                style={{
                  bottom: position.bottom,
                  left: position.left,
                  width: POPOVER_WIDTH,
                  height: POPOVER_HEIGHT,
                }}
                role="dialog"
                aria-modal="true"
                aria-label={t('inbox.interakt.toolEmoji')}
                onClick={(event) => event.stopPropagation()}
              >
                {loading || !Picker || !emojiData ? (
                  <div className="inbox-interakt-emoji-popover__loading">
                    <MaterialSymbol name="sync" size={22} spin />
                    <span>{t('inbox.interakt.emojiLoading')}</span>
                  </div>
                ) : (
                  <div className="inbox-interakt-emoji-popover__picker">
                    <Picker
                      data={emojiData}
                      onEmojiSelect={(emoji: EmojiSelectPayload) => insertEmoji(emoji.native)}
                      theme="light"
                      locale={emojiMartLocale(i18n.language)}
                      categories={[...EMOJI_CATEGORIES]}
                      previewPosition="none"
                      skinTonePosition="search"
                      navPosition="bottom"
                      searchPosition="sticky"
                      maxFrequentRows={2}
                      perLine={8}
                      emojiSize={22}
                      emojiButtonSize={36}
                      dynamicWidth
                      icons="outline"
                    />
                  </div>
                )}
              </div>
            )}
          </>,
          document.body,
        )}
    </>
  );
}
