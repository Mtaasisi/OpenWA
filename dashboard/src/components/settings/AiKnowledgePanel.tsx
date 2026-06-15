import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { aiApi } from '../../services/api';
import { formatRelativeTime } from '../../lib/dashboard-metrics';
import { useToast } from '../Toast';
import { MaterialSymbol } from '../MaterialSymbol';
import { SettingsIntegrationShell } from './SettingsIntegrationShell';
import { SettingsDocumentEditor } from './SettingsDocumentEditor';
import { AiRagFeatureToggle } from './AiRagFeatureToggle';
import './AiKnowledgePanel.css';

type Props = {
  onBack: () => void;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AiKnowledgePanel({ onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedPath, setSelectedPath] = useState('SHOP.md');
  const [content, setContent] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const { data: indexStatus } = useQuery({
    queryKey: ['ai-knowledge', 'index-status'],
    queryFn: () => aiApi.getKnowledgeIndexStatus(),
  });

  const reindexMutation = useMutation({
    mutationFn: () => aiApi.reindexKnowledge(),
    onSuccess: res => {
      toast.success(t('ai.knowledge.reindexDone', { files: res.files, chunks: res.chunks }));
      void qc.invalidateQueries({ queryKey: ['ai-knowledge'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['ai-knowledge', 'files'],
    queryFn: () => aiApi.listKnowledgeFiles(),
  });

  const {
    data: fileData,
    isLoading: fileLoading,
    isError: fileLoadError,
    error: fileLoadErrorDetail,
  } = useQuery({
    queryKey: ['ai-knowledge', 'file', selectedPath],
    queryFn: () => aiApi.readKnowledgeFile(selectedPath),
    enabled: !!selectedPath,
  });

  const { data: searchData, isFetching: searchFetching } = useQuery({
    queryKey: ['ai-knowledge', 'search', searchQ],
    queryFn: () => aiApi.searchKnowledge(searchQ),
    enabled: searchQ.trim().length >= 2,
  });

  useEffect(() => {
    setContent('');
  }, [selectedPath]);

  useEffect(() => {
    if (fileData?.content != null) setContent(fileData.content);
  }, [fileData?.content]);

  const isDirty = useMemo(
    () => fileData?.content != null && content !== fileData.content,
    [content, fileData?.content],
  );

  const saveMutation = useMutation({
    mutationFn: () => aiApi.writeKnowledgeFile(selectedPath, content),
    onSuccess: () => {
      toast.success(t('ai.knowledge.saved'));
      void qc.invalidateQueries({ queryKey: ['ai-knowledge'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const files = filesData?.files ?? [];
  const chunks = indexStatus?.chunks ?? 0;

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + (file.size ?? 0), 0),
    [files],
  );

  const latestFileUpdate = useMemo(() => {
    const sorted = [...files]
      .filter(f => f.updatedAt)
      .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!));
    return sorted[0]?.updatedAt ?? null;
  }, [files]);

  const recentActivity = useMemo(() => {
    return [...files]
      .filter(f => f.updatedAt)
      .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!))
      .slice(0, 3);
  }, [files]);

  const selectedFileMeta = files.find(f => f.path === selectedPath);
  const lastEditedLabel = selectedFileMeta?.updatedAt
    ? t('ai.knowledge.lastEdited', {
        time: formatRelativeTime(selectedFileMeta.updatedAt, t),
      })
    : null;

  const indexHealthPercent = useMemo(() => {
    if (chunks <= 0) return 18;
    const target = Math.max(files.length * 6, 12);
    return Math.min(100, Math.round((chunks / target) * 100));
  }, [chunks, files.length]);

  const indexHealthLabel =
    chunks > 0 && files.length > 0
      ? t('ai.knowledge.trainingHealthy')
      : t('ai.knowledge.trainingNeedsSetup');

  return (
    <SettingsIntegrationShell
      chromeless
      backSection="ai"
      onBack={onBack}
      title={t('ai.knowledge.title')}
      askAiPanelId="ai-knowledge"
      formTitle={t('ai.knowledge.title')}
      formIcon="menu_book"
      formIntro={t('ai.knowledge.pageSubtitle')}
      isDirty={isDirty}
      headerActions={
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm"
          disabled={reindexMutation.isPending}
          onClick={() => reindexMutation.mutate()}
        >
          {reindexMutation.isPending ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <MaterialSymbol name="sync" size={16} />
          )}
          {t('ai.knowledge.reindex')}
        </button>
      }
    >
        <div className="ai-knowledge-panel">
        <div className="ai-knowledge-panel__body">
          <AiRagFeatureToggle
            field="knowledgeRagEnabled"
            labelKey="ai.settings.shopKnowledge"
            hintKey="ai.settings.shopKnowledgeDesc"
          />
          <div className="ai-knowledge-index-card">
            <div className="ai-knowledge-index-card__icon">
              <MaterialSymbol name="database" size={28} filled />
            </div>
            <div className="ai-knowledge-index-card__text">
              <h3 className="ai-knowledge-index-card__label">{t('ai.knowledge.indexStatusTitle')}</h3>
              <p className="ai-knowledge-index-card__value">
                {t('ai.knowledge.indexStatus', { count: chunks })}
              </p>
            </div>
            {latestFileUpdate ? (
              <div className="ai-knowledge-index-card__updated">
                {t('ai.knowledge.lastUpdated', {
                  time: formatRelativeTime(latestFileUpdate, t),
                })}
              </div>
            ) : null}
          </div>

          <p className="ai-knowledge-panel__hint">{t('ai.knowledge.bundledDefaultHint')}</p>

          <SettingsDocumentEditor
            variant="split"
            files={files}
            filesLoading={filesLoading}
            selectedPath={selectedPath}
            onSelectPath={setSelectedPath}
            content={content}
            onChangeContent={setContent}
            fileLoading={fileLoading}
            loadError={
              fileLoadError
                ? fileLoadErrorDetail instanceof Error
                  ? fileLoadErrorDetail.message
                  : t('ai.knowledge.loadFailed')
                : null
            }
            onSave={() => saveMutation.mutate()}
            saving={saveMutation.isPending}
            searchQ={searchQ}
            onSearchChange={setSearchQ}
            searchFetching={searchFetching}
            searchResults={searchData?.results ?? []}
            onClearSearch={() => setSearchQ('')}
            lastEditedLabel={lastEditedLabel}
          />

          <div className="ai-knowledge-bento">
            <div className="ai-knowledge-bento__card">
              <h4>{t('ai.knowledge.trainingStatus')}</h4>
              <div className="ai-knowledge-bento__row">
                <span className="ai-knowledge-bento__metric">{indexHealthLabel}</span>
                <span className="ai-knowledge-bento__sub ai-knowledge-bento__sub--accent">
                  {t('ai.knowledge.trainingFiles', { count: files.length })}
                </span>
              </div>
              <div className="ai-knowledge-bento__bar">
                <span style={{ width: `${indexHealthPercent}%` }} />
              </div>
            </div>
            <div className="ai-knowledge-bento__card">
              <h4>{t('ai.knowledge.storageUsage')}</h4>
              <div className="ai-knowledge-bento__row">
                <span className="ai-knowledge-bento__metric">{formatBytes(totalBytes)}</span>
                <span className="ai-knowledge-bento__sub">
                  {t('ai.knowledge.storageFiles', { count: files.length })}
                </span>
              </div>
              <div className="ai-knowledge-bento__bar">
                <span style={{ width: `${Math.min(100, Math.max(8, totalBytes / (100 * 1024)))}%` }} />
              </div>
            </div>
            <div className="ai-knowledge-bento__card">
              <h4>{t('ai.knowledge.recentActivity')}</h4>
              {recentActivity.length ? (
                <ul className="ai-knowledge-bento__activity">
                  {recentActivity.map(file => (
                    <li key={file.path}>
                      {t('ai.knowledge.activityUpdated', {
                        file: file.path,
                        time: formatRelativeTime(file.updatedAt!, t),
                      })}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ai-knowledge-bento__sub">{t('ai.knowledge.noRecentActivity')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsIntegrationShell>
  );
}
