import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { RoleProvider, useRole, type UserRole } from './hooks/useRole';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';
import './components/workspace/workspace-interakt.css';
import { channelsUrl } from './lib/channel-routes';
import { settingsPanelHref } from './components/settings/settings-nav-registry';
import { disconnectSharedSocket } from './lib/socket-manager';
import {
  AUTH_SESSION_CLEARED_EVENT,
  clearAuthSession,
  getAccessToken,
  hasAuthSession,
  setAuthSession,
  type AuthUser,
} from './lib/auth-storage';
import { authApi } from './services/api';
import { lazyWithRetry } from './lib/lazy-with-retry';

const Login = lazy(lazyWithRetry(() => import('./pages/Login').then(m => ({ default: m.Login }))));
const Dashboard = lazy(lazyWithRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard }))));
const Inbox = lazy(lazyWithRetry(() => import('./pages/Inbox').then(m => ({ default: m.Inbox }))));
const Themes = lazy(lazyWithRetry(() => import('./pages/Themes').then(m => ({ default: m.Themes }))));
const Settings = lazy(lazyWithRetry(() => import('./pages/Settings').then(m => ({ default: m.Settings }))));
const Products = lazy(lazyWithRetry(() => import('./pages/Products').then(m => ({ default: m.Products }))));
const Followups = lazy(lazyWithRetry(() => import('./pages/Followups').then(m => ({ default: m.Followups }))));
const Customers = lazy(lazyWithRetry(() => import('./pages/Customers').then(m => ({ default: m.Customers }))));
const Pipeline = lazy(lazyWithRetry(() => import('./pages/Pipeline').then(m => ({ default: m.Pipeline }))));
const AiChat = lazy(lazyWithRetry(() => import('./pages/AiChat').then(m => ({ default: m.AiChat }))));
const AiTrainingCenter = lazy(lazyWithRetry(() => import('./pages/AiTrainingCenter').then(m => ({ default: m.AiTrainingCenterPage }))));
const Quotes = lazy(lazyWithRetry(() => import('./pages/Quotes').then(m => ({ default: m.Quotes }))));
const Templates = lazy(lazyWithRetry(() => import('./pages/Templates').then(m => ({ default: m.Templates }))));
const Automations = lazy(lazyWithRetry(() => import('./pages/Automations').then(m => ({ default: m.Automations }))));
const Content = lazy(lazyWithRetry(() => import('./pages/Content').then(m => ({ default: m.Content }))));
const Campaigns = lazy(lazyWithRetry(() => import('./pages/Campaigns').then(m => ({ default: m.Campaigns }))));
const Reports = lazy(lazyWithRetry(() => import('./pages/Reports').then(m => ({ default: m.Reports }))));
const Channels = lazy(lazyWithRetry(() => import('./pages/Channels').then(m => ({ default: m.Channels }))));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (/too many requests|429/i.test(msg)) return false;
        if (/session expired|unauthorized|authentication required|invalid api key/i.test(msg)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const SESSION_VALIDATE_MS = 8_000;

type BootState = 'pending' | 'ok' | 'failed';

function AppContent() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(hasAuthSession());
  const [bootState, setBootState] = useState<BootState>(hasAuthSession() ? 'pending' : 'ok');
  const { setRole, setRoleValidated, role, roleValidated } = useRole();

  const clearSession = () => {
    setIsAuthenticated(false);
    setRole(null);
    setRoleValidated(false);
    setBootState('ok');
    clearAuthSession();
    disconnectSharedSocket();
  };

  const applyUser = (user: AuthUser) => {
    setRole(user.role as UserRole);
    setRoleValidated(true);
    localStorage.setItem('openwa_user_role', user.role);
    if (user.staffId) sessionStorage.setItem('openwa_key_id', user.staffId);
    sessionStorage.setItem('openwa_key_name', user.name);
  };

  const validateSession = async (): Promise<boolean> => {
    if (!getAccessToken()) return false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SESSION_VALIDATE_MS);
    try {
      const user = await authApi.me();
      if (!user?.role) return false;
      applyUser(user);
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  };

  const handleLogin = async (
    accessToken: string,
    refreshToken: string,
    user: AuthUser,
  ) => {
    setAuthSession(accessToken, refreshToken, user);
    setIsAuthenticated(true);
    setBootState('pending');
    applyUser(user);
    setBootState('ok');
  };

  const handleLogout = () => {
    clearSession();
  };

  useEffect(() => {
    if (!hasAuthSession()) return;
    let cancelled = false;

    void (async () => {
      setBootState('pending');
      const ok = await validateSession();
      if (cancelled) return;
      if (ok) {
        setBootState('ok');
        return;
      }
      setRole(null);
      setRoleValidated(false);
      setBootState('failed');
    })();

    return () => {
      cancelled = true;
    };
  }, [setRole, setRoleValidated]);

  useEffect(() => {
    const onAuthCleared = () => {
      queryClient.clear();
      setIsAuthenticated(false);
      setRole(null);
      setRoleValidated(false);
      setBootState('ok');
      disconnectSharedSocket();
    };
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, onAuthCleared);
    return () => window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, onAuthCleared);
  }, [setRole, setRoleValidated]);

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (!isAuthenticated) {
    return <Suspense fallback={loadingFallback}><Login onLogin={handleLogin} /></Suspense>;
  }

  if (bootState === 'pending') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
        <Loader2 className="animate-spin" size={32} />
        <p>{t('app.boot.validatingSession')}</p>
      </div>
    );
  }

  if (bootState === 'failed') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ margin: 0, maxWidth: 360 }}>
          {t('app.boot.apiUnreachable')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            onClick={() => {
              if (!hasAuthSession()) {
                clearSession();
                return;
              }
              setBootState('pending');
              void validateSession().then(ok => {
                if (ok) setBootState('ok');
                else setBootState('failed');
              });
            }}
          >
            {t('app.boot.retry')}
          </button>
          <button type="button" className="fu-btn fu-btn--ghost" onClick={clearSession}>
            {t('app.boot.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (!roleValidated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ margin: 0, maxWidth: 360 }}>{t('app.boot.sessionInvalid')}</p>
        <button type="button" className="fu-btn fu-btn--primary" onClick={clearSession}>
          {t('app.boot.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={loadingFallback}>
        <Routes>
          <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
            <Route index element={<Dashboard />} />
            <Route path="sessions" element={<Navigate to={channelsUrl({ channel: 'whatsapp', add: true })} replace />} />
            <Route
              path="webhooks"
              element={
                <Navigate
                  to={settingsPanelHref('webhooks', { moved: 'webhooks' })}
                  replace
                />
              }
            />
            <Route
              path="infrastructure"
              element={
                <Navigate
                  to={settingsPanelHref('infrastructure', { moved: 'infrastructure' })}
                  replace
                />
              }
            />
            <Route
              path="api-keys"
              element={
                <Navigate
                  to={settingsPanelHref('api-keys', { moved: 'api-keys' })}
                  replace
                />
              }
            />
            <Route
              path="plugins"
              element={
                <Navigate
                  to={settingsPanelHref('plugins', { moved: 'plugins' })}
                  replace
                />
              }
            />
            <Route
              path="logs"
              element={
                <Navigate to={settingsPanelHref('logs', { moved: 'logs' })} replace />
              }
            />
            <Route
              path="message-tester"
              element={<Navigate to="/settings?section=system" replace />}
            />
            <Route path="inbox" element={<Inbox />} />
            <Route path="followups" element={<Followups />} />
            <Route path="customers" element={<Customers />} />
            <Route path="followups/reports" element={<Navigate to="/reports?section=staff" replace />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="pipeline/dashboard" element={<Navigate to="/reports?section=pipeline" replace />} />
            <Route path="pipeline/reports" element={<Navigate to="/reports?section=pipeline" replace />} />
            <Route path="products" element={<Products />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="templates" element={<Templates />} />
            <Route path="automations" element={<Automations />} />
            <Route path="content" element={<Content />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="reports" element={<Reports />} />
            <Route path="channels" element={<Channels />} />
            <Route path="ai" element={<AiChat />} />
            <Route path="ai-training-center/*" element={<AiTrainingCenter />} />
            <Route path="settings" element={<Settings />} />
            <Route
              path="settings/storage-backup"
              element={
                <Navigate to={settingsPanelHref('storage-backup')} replace />
              }
            />
            <Route path="themes" element={<Themes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
