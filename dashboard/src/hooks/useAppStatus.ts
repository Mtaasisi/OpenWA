import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appStatusApi } from '../services/api';
import type { AppStatusResponse } from '../types/appStatusTypes';
import { loadStatusBarPreferences } from '../lib/app-status-preferences';
import { useWebSocket } from './useWebSocket';

const QUERY_KEY = ['app', 'status'] as const;

export function useAppStatus() {
  const [prefs, setPrefs] = useState(loadStatusBarPreferences);
  const lastErrorToastRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const onPrefs = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setPrefs(loadStatusBarPreferences());
    };
    window.addEventListener('openwa-status-bar-prefs-updated', onPrefs);
    return () => window.removeEventListener('openwa-status-bar-prefs-updated', onPrefs);
  }, []);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => appStatusApi.get(),
    refetchInterval: prefs.refreshInterval,
    refetchIntervalInBackground: true,
    staleTime: Math.max(0, prefs.refreshInterval - 250),
    retry: 1,
    placeholderData: previous => previous,
    refetchOnWindowFocus: false,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  useWebSocket({
    subscribeAllSessions: true,
    sessionEvents: ['session.status', 'session.qr'],
    onSessionStatus: invalidate,
    globalEvents: ['message.sent', 'message.received'],
    onGlobalEvent: invalidate,
  });

  const data = query.data;
  const lastUpdated = data?.updatedAt ?? null;
  const isStale = query.isError && !!data;
  const isInitialLoading = query.isLoading && !data;
  const isLoading = isInitialLoading;

  return {
    data,
    isLoading,
    isInitialLoading,
    isError: query.isError,
    isStale,
    lastUpdated,
    refetch: query.refetch,
    prefs,
    lastErrorToastRef,
  };
}

export type { AppStatusResponse };
