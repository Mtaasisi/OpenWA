import { useVirtualizer } from '@tanstack/react-virtual';
import type { RefObject, ReactNode } from 'react';

const ROW_ESTIMATE_PX = 72;
const VIRTUAL_THRESHOLD = 80;

interface Props<T> {
  items: T[];
  scrollRootRef: RefObject<HTMLElement | null>;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
}

export function InboxVirtualMessageList<T>({
  items,
  scrollRootRef,
  getKey,
  renderItem,
  estimateSize = ROW_ESTIMATE_PX,
}: Props<T>) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRootRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  });

  if (items.length <= VIRTUAL_THRESHOLD) {
    return (
      <div className="inbox-virtual-messages-fallback">
        {items.map((item, index) => (
          <div key={getKey(item, index)}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      className="inbox-virtual-messages"
      style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
    >
      {virtualItems.map(virtualRow => {
        const item = items[virtualRow.index];
        if (!item) return null;
        return (
          <div
            key={getKey(item, virtualRow.index)}
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
