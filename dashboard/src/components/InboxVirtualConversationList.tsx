import { useVirtualizer } from '@tanstack/react-virtual';
import type { RefObject, ReactNode } from 'react';

const ROW_ESTIMATE_PX = 92;

interface InboxVirtualConversationListProps<T> {
  items: T[];
  scrollRootRef: RefObject<HTMLElement | null>;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number | ((index: number) => number);
}

export function InboxVirtualConversationList<T>({
  items,
  scrollRootRef,
  getKey,
  renderItem,
  estimateSize = ROW_ESTIMATE_PX,
}: InboxVirtualConversationListProps<T>) {
  const resolveEstimate = (index: number) =>
    typeof estimateSize === 'function' ? estimateSize(index) : estimateSize;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRootRef.current,
    estimateSize: resolveEstimate,
    getItemKey: index => getKey(items[index]!, index),
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (items.length === 0) return null;

  return (
    <div
      className="inbox-virtual-list"
      style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
    >
      {virtualItems.map(virtualRow => {
        const item = items[virtualRow.index];
        if (!item) return null;
        return (
          <div
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(item, virtualRow.index)}
          </div>
        );
      })}
    </div>
  );
}
