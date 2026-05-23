import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Package, Plug, Unplug, LogIn } from 'lucide-react';
import { productsApi } from '../../services/api';
import { signInToInauzwaSupabase } from '../../lib/inauzwaSupabaseLogin';
import { useRole } from '../../hooks/useRole';
import '../../pages/Products.css';

interface InauzwaIntegrationPanelProps {
  /** Open configured sync details by default (Products page). */
  defaultOpen?: boolean;
  /** Show shortcut to full catalog page. */
  showCatalogLink?: boolean;
}

export function InauzwaIntegrationPanel({
  defaultOpen = false,
  showCatalogLink = false,
}: InauzwaIntegrationPanelProps) {
  const { t } = useTranslation();
  const { canWrite, isAdmin } = useRole();
  const queryClient = useQueryClient();

  const [syncBranchId, setSyncBranchId] = useState('');
  const [syncVendorId, setSyncVendorId] = useState('');
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(60);
  const [refreshBeforeSend, setRefreshBeforeSend] = useState(true);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [connectMode, setConnectMode] = useState<'login' | 'database' | 'api'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginApiUrl, setLoginApiUrl] = useState('');
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [currency, setCurrency] = useState('TZS');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  const { data: inauzwaStatus, refetch: refetchInauzwaStatus, isLoading } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['products', 'inauzwa-branches'],
    queryFn: () => productsApi.listInauzwaBranches(),
    enabled: !!inauzwaStatus?.database,
  });

  useEffect(() => {
    if (!inauzwaStatus?.preferences) return;
    const p = inauzwaStatus.preferences;
    setSyncBranchId(p.branchId ?? inauzwaStatus.branchId ?? '');
    setSyncVendorId(p.vendorId ?? inauzwaStatus.vendorId ?? '');
    setAutoSyncEnabled(p.autoSyncEnabled);
    setAutoSyncInterval(p.autoSyncIntervalMinutes);
    setRefreshBeforeSend(p.refreshBeforeSend);
    setCurrency(p.currency || inauzwaStatus.currency || 'TZS');
    if (p.connection.source === 'api') setConnectMode(p.connection.connectedViaLogin ? 'login' : 'api');
    if (p.connection.apiUrl) setApiUrl(p.connection.apiUrl);
    if (inauzwaStatus.defaultApiUrl && !loginApiUrl) {
      setLoginApiUrl(inauzwaStatus.defaultApiUrl);
    } else if (p.connection.apiUrl && !loginApiUrl) {
      setLoginApiUrl(p.connection.apiUrl);
    }
  }, [inauzwaStatus?.preferences, inauzwaStatus?.branchId, inauzwaStatus?.vendorId, inauzwaStatus?.currency, inauzwaStatus?.defaultApiUrl, loginApiUrl]);

  const invalidateProducts = () => void queryClient.invalidateQueries({ queryKey: ['products'] });

  const formatSyncResult = (res: {
    productsCreated: number;
    productsUpdated: number;
    productsDeactivated: number;
    variantsCreated: number;
    variantsUpdated: number;
    source: string;
  }) =>
    t('products.inauzwa.result', {
      created: res.productsCreated,
      updated: res.productsUpdated,
      deactivated: res.productsDeactivated,
      variants: res.variantsCreated + res.variantsUpdated,
      source: res.source,
    });

  const saveInauzwaSettings = useMutation({
    mutationFn: () =>
      productsApi.updateInauzwaSettings({
        branchId: syncBranchId.trim() || null,
        vendorId: syncVendorId.trim() || null,
        autoSyncEnabled,
        autoSyncIntervalMinutes: autoSyncInterval,
        refreshBeforeSend,
      }),
    onSuccess: () => void refetchInauzwaStatus(),
  });

  const loginInauzwa = useMutation({
    mutationFn: async () => {
      const email = loginEmail.trim();
      const password = loginPassword;
      const apiUrl = loginApiUrl.trim() || undefined;

      if (inauzwaStatus?.hasSupabaseConfig && inauzwaStatus.defaultSupabaseUrl && inauzwaStatus.defaultSupabaseAnonKey) {
        try {
          const session = await signInToInauzwaSupabase(
            inauzwaStatus.defaultSupabaseUrl,
            inauzwaStatus.defaultSupabaseAnonKey,
            email,
            password,
          );
          return productsApi.completeInauzwaSupabaseSession({
            accessToken: session.accessToken,
            email: session.email,
            supabaseUrl: inauzwaStatus.defaultSupabaseUrl,
            supabaseAnonKey: inauzwaStatus.defaultSupabaseAnonKey,
            apiUrl,
            branchId: session.branchId,
            vendorId: session.vendorId,
            fullName: session.fullName,
          });
        } catch {
          // Browser Supabase auth can fail on localhost (CORS/site URL). Fall back to server login.
        }
      }

      return productsApi.loginInauzwa({ email, password, apiUrl });
    },
    onSuccess: res => {
      setLoginPassword('');
      setSyncBranchId(res.branchId ?? res.preferences.branchId ?? '');
      setSyncVendorId(res.vendorId ?? res.preferences.vendorId ?? '');
      setConnectionMessage(
        t('products.inauzwa.loginSuccess', {
          email: res.email,
          branch: res.branchId ?? t('products.inauzwa.branchNotAssigned'),
        }),
      );
      void refetchInauzwaStatus();
      void queryClient.invalidateQueries({ queryKey: ['products', 'inauzwa-branches'] });
    },
    onError: (err: Error) => setConnectionMessage(err.message),
  });

  const saveConnection = useMutation({
    mutationFn: () =>
      productsApi.updateInauzwaConnection({
        databaseUrl: connectMode === 'database' ? databaseUrl.trim() || null : null,
        apiUrl: connectMode === 'api' ? apiUrl.trim() || null : null,
        apiToken: connectMode === 'api' ? apiToken : undefined,
        currency: currency.trim() || null,
        loginEmail: null,
      }),
    onSuccess: () => {
      setConnectionMessage(t('products.inauzwa.connectionSaved'));
      setDatabaseUrl('');
      setApiToken('');
      void refetchInauzwaStatus();
      void queryClient.invalidateQueries({ queryKey: ['products', 'inauzwa-branches'] });
    },
    onError: (err: Error) => setConnectionMessage(err.message),
  });

  const testConnection = useMutation({
    mutationFn: () =>
      productsApi.testInauzwaConnection({
        mode: connectMode === 'login' ? undefined : connectMode,
        databaseUrl: connectMode === 'database' ? databaseUrl.trim() : undefined,
        apiUrl: connectMode === 'api' ? apiUrl.trim() : undefined,
        apiToken: connectMode === 'api' ? apiToken.trim() : undefined,
      }),
    onSuccess: res =>
      setConnectionMessage(
        res.source === 'database'
          ? t('products.inauzwa.connectionTestOkBranches', { count: res.branchCount ?? 0 })
          : t('products.inauzwa.connectionTestOk'),
      ),
    onError: (err: Error) => setConnectionMessage(err.message),
  });

  const disconnectConnection = useMutation({
    mutationFn: () => productsApi.updateInauzwaConnection({ clearConnection: true }),
    onSuccess: () => {
      setConnectionMessage(t('products.inauzwa.connectionCleared'));
      void refetchInauzwaStatus();
    },
    onError: (err: Error) => setConnectionMessage(err.message),
  });

  const syncInauzwa = useMutation({
    mutationFn: async () => {
      await saveInauzwaSettings.mutateAsync();
      return productsApi.syncInauzwa({
        branchId: syncBranchId.trim() || undefined,
        vendorId: syncVendorId.trim() || undefined,
        mode: syncMode,
        activeOnly: true,
      });
    },
    onSuccess: res => {
      invalidateProducts();
      void refetchInauzwaStatus();
      setSyncResult(formatSyncResult(res));
    },
    onError: (err: Error) => setSyncResult(err.message),
  });

  const quickSync = useMutation({
    mutationFn: () => productsApi.quickSyncInauzwa(),
    onSuccess: res => {
      invalidateProducts();
      void refetchInauzwaStatus();
      setSyncResult(formatSyncResult(res));
    },
    onError: (err: Error) => setSyncResult(err.message),
  });

  const canSaveConnection =
    connectMode === 'database'
      ? !!databaseUrl.trim()
      : connectMode === 'api'
        ? !!apiUrl.trim() && (!!apiToken.trim() || !!inauzwaStatus?.preferences.connection.hasApiToken)
        : false;

  const renderConnectionSetup = () => (
    <div className="products-sync-connection">
      <p className="products-sync-card__hint">{t('products.inauzwa.connectHint')}</p>
      {!isAdmin && (
        <p className="products-sync-card__hint">{t('products.inauzwa.connectAdminOnly')}</p>
      )}
      {isAdmin && (
        <>
          <div className="products-form-row">
            <label>
              {t('products.inauzwa.connectMode')}
              <select
                value={connectMode}
                onChange={e => setConnectMode(e.target.value as 'login' | 'database' | 'api')}
              >
                <option value="login">{t('products.inauzwa.connectModeLogin')}</option>
                <option value="database">{t('products.inauzwa.connectModeDatabase')}</option>
                <option value="api">{t('products.inauzwa.connectModeApi')}</option>
              </select>
            </label>
            {connectMode !== 'login' && (
              <label>
                {t('products.fields.currency')}
                <input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="TZS" />
              </label>
            )}
          </div>
          {connectMode === 'login' ? (
            <>
              <label className="products-sync-connection__full">
                {t('products.inauzwa.apiUrl')}
                <input
                  value={loginApiUrl}
                  onChange={e => setLoginApiUrl(e.target.value)}
                  placeholder={t('products.inauzwa.apiUrlPlaceholder')}
                />
              </label>
              <div className="products-form-row">
                <label>
                  {t('products.inauzwa.loginEmail')}
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="you@store.com"
                    autoComplete="username"
                  />
                </label>
                <label>
                  {t('products.inauzwa.loginPassword')}
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
              </div>
              <div className="products-sync-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!loginEmail.trim() || !loginPassword || loginInauzwa.isPending}
                  onClick={() => loginInauzwa.mutate()}
                >
                  {loginInauzwa.isPending ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <LogIn size={14} />
                  )}
                  {t('products.inauzwa.signIn')}
                </button>
              </div>
              <p className="products-sync-card__hint products-sync-card__hint--sub">
                {t('products.inauzwa.loginNote')}
              </p>
            </>
          ) : connectMode === 'database' ? (
            <label className="products-sync-connection__full">
              {t('products.inauzwa.databaseUrl')}
              <input
                type="password"
                value={databaseUrl}
                onChange={e => setDatabaseUrl(e.target.value)}
                placeholder={t('products.inauzwa.databaseUrlPlaceholder')}
                autoComplete="off"
              />
            </label>
          ) : (
            <div className="products-form-row">
              <label>
                {t('products.inauzwa.apiUrl')}
                <input
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  placeholder={t('products.inauzwa.apiUrlPlaceholder')}
                />
              </label>
              <label>
                {t('products.inauzwa.apiToken')}
                <input
                  type="password"
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder={t('products.inauzwa.apiTokenPlaceholder')}
                  autoComplete="off"
                />
              </label>
            </div>
          )}

          {connectMode !== 'login' && (
          <div className="products-sync-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canSaveConnection || testConnection.isPending}
              onClick={() => testConnection.mutate()}
            >
              {testConnection.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plug size={14} />}
              {t('products.inauzwa.testConnection')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSaveConnection || saveConnection.isPending}
              onClick={() => saveConnection.mutate()}
            >
              {saveConnection.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
              {t('products.inauzwa.saveConnection')}
            </button>
          </div>
          )}
        </>
      )}
      {connectionMessage && <p className="inbox-crm-save-msg">{connectionMessage}</p>}
    </div>
  );

  if (isLoading) {
    return (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (!inauzwaStatus) return null;

  const detailsOpen = defaultOpen && inauzwaStatus.configured;
  const connection = inauzwaStatus.preferences.connection;

  return (
    <div className="settings-integration-panel">
      <section
        className={`products-sync-card ${!inauzwaStatus.configured ? 'products-sync-card--compact' : ''}`}
      >
        {!inauzwaStatus.configured ? (
          <details className="products-sync-setup" open={defaultOpen}>
            <summary className="products-sync-setup__summary">
              <span className="products-sync-setup__title">{t('products.inauzwa.title')}</span>
              <span className="products-sync-setup__badge">{t('products.inauzwa.notConfiguredBadge')}</span>
            </summary>
            <div className="products-sync-setup__body">
              <p className="products-sync-card__desc">{t('products.inauzwa.description')}</p>
              {renderConnectionSetup()}
            </div>
          </details>
        ) : (
          <details className="products-sync-setup products-sync-setup--configured" open={detailsOpen}>
            <summary className="products-sync-setup__summary">
              <span className="products-sync-setup__title">{t('products.inauzwa.title')}</span>
              <span className="products-sync-setup__badge products-sync-setup__badge--ok">
                {inauzwaStatus.database
                  ? t('products.inauzwa.viaDatabase')
                  : t('products.inauzwa.viaApi')}
              </span>
            </summary>
            <div className="products-sync-setup__body">
              <p className="products-sync-card__desc">{t('products.inauzwa.description')}</p>
              {connection.configuredVia === 'env' ? (
                <p className="products-sync-card__hint">{t('products.inauzwa.configuredViaEnv')}</p>
              ) : (
                <div className="products-sync-connection-summary">
                  <p className="products-sync-card__hint">
                    {connection.connectedViaLogin && connection.loginEmail
                      ? connection.source === 'supabase'
                        ? t('products.inauzwa.connectedSupabase', { email: connection.loginEmail })
                        : t('products.inauzwa.connectedLogin', { email: connection.loginEmail })
                      : connection.source === 'database' || connection.source === 'supabase'
                        ? t('products.inauzwa.connectedDatabase', {
                            url: connection.databaseUrlMasked ?? '—',
                          })
                        : t('products.inauzwa.connectedApi', { url: connection.apiUrl ?? '—' })}
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={disconnectConnection.isPending}
                      onClick={() => disconnectConnection.mutate()}
                    >
                      {disconnectConnection.isPending ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <Unplug size={14} />
                      )}
                      {t('products.inauzwa.disconnect')}
                    </button>
                  )}
                </div>
              )}
              <div className="products-form-row">
                <label>
                  {t('products.inauzwa.branch')}
                  {branches.length > 0 ? (
                    <select
                      value={syncBranchId}
                      onChange={e => setSyncBranchId(e.target.value)}
                      disabled={!canWrite}
                    >
                      <option value="">{t('products.inauzwa.selectBranch')}</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={syncBranchId}
                      onChange={e => setSyncBranchId(e.target.value)}
                      placeholder={inauzwaStatus.branchId ?? 'branch-uuid'}
                      disabled={!canWrite}
                    />
                  )}
                </label>
                <label>
                  {t('products.inauzwa.vendor')}
                  <input
                    value={syncVendorId}
                    onChange={e => setSyncVendorId(e.target.value)}
                    placeholder={inauzwaStatus.vendorId ?? t('products.inauzwa.vendorPlaceholder')}
                    disabled={!canWrite}
                  />
                </label>
              </div>
              <div className="products-form-row">
                <label>
                  {t('products.inauzwa.mode')}
                  <select
                    value={syncMode}
                    onChange={e => setSyncMode(e.target.value as 'merge' | 'replace')}
                    disabled={!canWrite}
                  >
                    <option value="merge">{t('products.inauzwa.modes.merge')}</option>
                    <option value="replace">{t('products.inauzwa.modes.replace')}</option>
                  </select>
                </label>
              </div>
              <div className="products-form-row">
                <label>
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={e => setAutoSyncEnabled(e.target.checked)}
                    disabled={!canWrite}
                  />{' '}
                  {t('products.inauzwa.autoSync')}
                </label>
                <label>
                  {t('products.inauzwa.intervalMinutes')}
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={autoSyncInterval}
                    onChange={e => setAutoSyncInterval(Number(e.target.value) || 60)}
                    disabled={!canWrite || !autoSyncEnabled}
                  />
                </label>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={refreshBeforeSend}
                  onChange={e => setRefreshBeforeSend(e.target.checked)}
                  disabled={!canWrite}
                />{' '}
                {t('products.inauzwa.refreshBeforeSend')}
              </label>
              {inauzwaStatus.preferences.lastSyncAt && (
                <p className="products-sync-card__hint">
                  {t('products.inauzwa.lastSync', {
                    time: new Date(inauzwaStatus.preferences.lastSyncAt).toLocaleString(),
                  })}
                </p>
              )}
              {inauzwaStatus.preferences.lastSyncError && (
                <p className="products-sync-card__error">{inauzwaStatus.preferences.lastSyncError}</p>
              )}
              {canWrite && (
                <div className="products-sync-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saveInauzwaSettings.isPending}
                    onClick={() => saveInauzwaSettings.mutate()}
                  >
                    {t('products.inauzwa.saveSettings')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={quickSync.isPending || syncInauzwa.isPending}
                    onClick={() => quickSync.mutate()}
                  >
                    {quickSync.isPending ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    {t('products.inauzwa.quickSync')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={syncInauzwa.isPending}
                    onClick={() => syncInauzwa.mutate()}
                  >
                    {syncInauzwa.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
                    {t('products.inauzwa.syncNow')}
                  </button>
                </div>
              )}
              {syncResult && <p className="inbox-crm-save-msg">{syncResult}</p>}
              {connectionMessage && <p className="inbox-crm-save-msg">{connectionMessage}</p>}
            </div>
          </details>
        )}
      </section>

      {showCatalogLink && (
        <p className="settings-integration-catalog-link">
          <Link to="/products" className="inbox-crm-link">
            <Package size={14} aria-hidden />
            {t('settings.integrations.manageCatalog')}
          </Link>
        </p>
      )}
    </div>
  );
}
