import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { RoleProvider, useRole, type UserRole } from './hooks/useRole';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Sessions = lazy(() => import('./pages/Sessions').then(m => ({ default: m.Sessions })));
const Inbox = lazy(() => import('./pages/Inbox').then(m => ({ default: m.Inbox })));
const Themes = lazy(() => import('./pages/Themes').then(m => ({ default: m.Themes })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Products = lazy(() => import('./pages/Products').then(m => ({ default: m.Products })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function AppContent() {
  // Initialize from sessionStorage to avoid setState in effect
  const savedKey = sessionStorage.getItem('openwa_api_key');
  const [isAuthenticated, setIsAuthenticated] = useState(!!savedKey);
  const [, setApiKey] = useState(savedKey || '');
  const { setRole, role } = useRole();

  const handleLogin = async (key: string) => {
    setApiKey(key);
    sessionStorage.setItem('openwa_api_key', key);

    // Fetch the role from API
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'X-API-Key': key },
      });
      if (response.ok) {
        const data = await response.json();
        setRole(data.role as UserRole);
      }
    } catch {
      // Default to viewer if we can't fetch role
      setRole('viewer');
    }

    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setApiKey('');
    setIsAuthenticated(false);
    setRole(null);
    sessionStorage.removeItem('openwa_api_key');
  };

  // Re-validate and get role on mount if already authenticated
  useEffect(() => {
    if (!savedKey) return;

    fetch('/api/auth/validate', {
      method: 'POST',
      headers: { 'X-API-Key': savedKey },
    })
      .then(async res => {
        if (!res.ok) return null;
        return res.json() as Promise<{ valid?: boolean; role?: string }>;
      })
      .then(data => {
        if (data?.valid && data.role) {
          setRole(data.role as UserRole);
        }
      })
      .catch(() => {
        // Keep existing role from localStorage if validation fails
      });
  }, [savedKey, setRole]);

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (!isAuthenticated) {
    return <Suspense fallback={loadingFallback}><Login onLogin={handleLogin} /></Suspense>;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={loadingFallback}>
        <Routes>
          <Route path="/" element={<Layout onLogout={handleLogout} userRole={role} />}>
            <Route index element={<Dashboard />} />
            <Route path="sessions" element={<Sessions />} />
            <Route
              path="webhooks"
              element={
                <Navigate
                  to="/settings?section=integrations&integration=webhooks&moved=webhooks"
                  replace
                />
              }
            />
            <Route
              path="infrastructure"
              element={
                <Navigate
                  to="/settings?section=integrations&integration=infrastructure&moved=infrastructure"
                  replace
                />
              }
            />
            <Route
              path="api-keys"
              element={
                <Navigate
                  to="/settings?section=integrations&integration=api-keys&moved=api-keys"
                  replace
                />
              }
            />
            <Route
              path="plugins"
              element={
                <Navigate
                  to="/settings?section=integrations&integration=plugins&moved=plugins"
                  replace
                />
              }
            />
            <Route
              path="logs"
              element={
                <Navigate to="/settings?section=api&tool=logs&moved=logs" replace />
              }
            />
            <Route
              path="message-tester"
              element={
                <Navigate
                  to="/settings?section=api&tool=message-tester&moved=message-tester"
                  replace
                />
              }
            />
            <Route path="inbox" element={<Inbox />} />
            <Route path="products" element={<Products />} />
            <Route path="settings" element={<Settings />} />
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
