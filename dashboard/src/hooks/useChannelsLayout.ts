import { useCallback, useEffect, useState } from 'react';

export const CHANNELS_MOBILE_BREAKPOINT_PX = 900;

export type ChannelsMobilePane = 'list' | 'detail';

export function useChannelsLayout() {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(`(max-width: ${CHANNELS_MOBILE_BREAKPOINT_PX}px)`).matches,
  );
  const [mobilePane, setMobilePane] = useState<ChannelsMobilePane>('list');

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${CHANNELS_MOBILE_BREAKPOINT_PX}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const openDetail = useCallback(() => {
    setMobilePane('detail');
  }, []);

  const openList = useCallback(() => {
    setMobilePane('list');
  }, []);

  return { isMobile, mobilePane, openDetail, openList };
}
