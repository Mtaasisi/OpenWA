import { useCallback, useMemo, useRef } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 12;

/** Opens a context menu after a stationary long-press (mobile / tablet). */
export function useInboxLongPress(onOpen: (clientX: number, clientY: number) => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return useMemo(
    () => ({
      onTouchStart: (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startRef.current = { x: touch.clientX, y: touch.clientY };
        clear();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          onOpenRef.current(touch.clientX, touch.clientY);
        }, LONG_PRESS_MS);
      },
      onTouchEnd: clear,
      onTouchCancel: clear,
      onTouchMove: (e: React.TouchEvent) => {
        if (!timerRef.current || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - startRef.current.x);
        const dy = Math.abs(touch.clientY - startRef.current.y);
        if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) clear();
      },
    }),
    [clear],
  );
}
