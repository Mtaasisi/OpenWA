import { useEffect, useRef, useState, type RefObject } from 'react';
import { Loader2 } from 'lucide-react';

type Props = {
  scrollRootRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  loading: boolean;
  onLoadMore: () => void;
  className?: string;
};

/** Loads the next conversation page when the user scrolls near the list bottom. */
export function InboxConversationListInfiniteScroll({
  scrollRootRef,
  enabled,
  loading,
  onLoadMore,
  className,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingRef = useRef(loading);
  const [pendingLoad, setPendingLoad] = useState(false);
  onLoadMoreRef.current = onLoadMore;
  loadingRef.current = loading;

  useEffect(() => {
    if (!loading) setPendingLoad(false);
  }, [loading]);

  useEffect(() => {
    if (!enabled) return;
    const sentinel = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !loadingRef.current) {
          setPendingLoad(true);
          onLoadMoreRef.current();
        }
      },
      { root, rootMargin: '160px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, scrollRootRef]);

  const showLoading = loading || pendingLoad;
  const showSentinel = enabled || showLoading;
  if (!showSentinel) return null;

  return (
    <div
      ref={sentinelRef}
      className={[
        'inbox-conversations-infinite-sentinel',
        showLoading ? 'inbox-conversations-infinite-sentinel--loading' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      aria-busy={showLoading}
    >
      {showLoading ? (
        <Loader2 className="inbox-conversations-infinite-sentinel__icon animate-spin" size={22} />
      ) : null}
    </div>
  );
}
