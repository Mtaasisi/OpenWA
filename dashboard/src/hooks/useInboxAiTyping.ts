import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

/** True while the customer AI agent is generating a reply in the active chat. */
export function useInboxAiTyping(sessionId: string | undefined, chatId: string | undefined): boolean {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    setTyping(false);
  }, [sessionId, chatId]);

  useWebSocket({
    sessionId: sessionId || undefined,
    sessionEvents: sessionId ? ['ai.typing'] : undefined,
    onGlobalEvent: (event, sid, data) => {
      if (event !== 'ai.typing' || !chatId || !sessionId) return;
      if (sid !== sessionId) return;
      if (data.chatId !== chatId) return;
      setTyping(data.active === true);
    },
  });

  return typing;
}
