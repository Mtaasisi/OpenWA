import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { aiApi } from '../../services/api';
import { useToast } from '../Toast';
import { useRole } from '../../hooks/useRole';
import { MaterialSymbol } from '../MaterialSymbol';
import {
  SettingsIntegrationShell,
  SettingsIntegrationStatusCard,
  SettingsIntegrationCard,
} from './SettingsIntegrationShell';
import { SettingsDocumentEditor } from './SettingsDocumentEditor';
import { AiRagFeatureToggle } from './AiRagFeatureToggle';

type Props = {
  onBack: () => void;
};

export function AiMemoryPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const [selectedPath, setSelectedPath] = useState('MEMORY.md');
  const [content, setContent] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const { data: indexStatus } = useQuery({
    queryKey: ['ai-memory', 'index-status'],
    queryFn: () => aiApi.getMemoryIndexStatus(),
  });

  const reindexMutation = useMutation({
    mutationFn: () => aiApi.reindexMemory(),
    onSuccess: res => {
      toast.success(t('ai.memory.reindexDone', { files: res.files, chunks: res.chunks }));
      void qc.invalidateQueries({ queryKey: ['ai-memory'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dreamMutation = useMutation({
    mutationFn: () => aiApi.runMemoryDream(),
    onSuccess: res => {
      toast.success(t('ai.memory.dreamDone', { count: res.promoted }));
      void qc.invalidateQueries({ queryKey: ['ai-memory'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['ai-memory', 'files'],
    queryFn: () => aiApi.listMemoryFiles(),
  });

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ['ai-memory', 'file', selectedPath],
    queryFn: () => aiApi.readMemoryFile(selectedPath),
    enabled: !!selectedPath,
  });

  const { data: searchData, isFetching: searchFetching } = useQuery({
    queryKey: ['ai-memory', 'search', searchQ],
    queryFn: () => aiApi.searchMemory(searchQ),
    enabled: searchQ.trim().length >= 2,
  });

  useEffect(() => {
    if (fileData?.content != null) setContent(fileData.content);
  }, [fileData?.content, selectedPath]);

  const isDirty = useMemo(
    () => fileData?.content != null && content !== fileData.content,
    [content, fileData?.content],
  );

  const saveMutation = useMutation({
    mutationFn: () => aiApi.writeMemoryFile(selectedPath, content),
    onSuccess: () => {
      toast.success(t('ai.memory.saved'));
      void qc.invalidateQueries({ queryKey: ['ai-memory'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const files = filesData?.files ?? [];

  return (
    <SettingsIntegrationShell
      chromeless
      backSection="ai"
      onBack={onBack}
      title={t('ai.memory.title')}
      askAiPanelId="ai-memory"
      isDirty={isDirty}
      status={
        <SettingsIntegrationStatusCard
          icon="psychology"
          label={t('ai.memory.indexLabel')}
          value={t('ai.memory.indexStatus', { count: indexStatus?.chunks ?? 0 })}
        />
      }
      headerActions={
        <>
          {isAdmin && (
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm"
              disabled={dreamMutation.isPending}
              onClick={() => dreamMutation.mutate()}
            >
              {dreamMutation.isPending ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <MaterialSymbol name="auto_awesome" size={16} />
              )}
              {t('ai.memory.dream')}
            </button>
          )}
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
            {t('ai.memory.reindex')}
          </button>
        </>
      }
    >
      <AiRagFeatureToggle
        field="memoryRagEnabled"
        labelKey="ai.settings.neuralMemory"
        hintKey="ai.settings.neuralMemoryDesc"
      />
      <SettingsIntegrationCard title={t('ai.memory.search')} icon="search">
        <div className="settings-int-field">
          <input
            id="ai-memory-search"
            type="search"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder={t('ai.memory.searchPlaceholder')}
          />
        </div>
        {searchFetching && (
          <p className="settings-hint" style={{ marginTop: '0.5rem' }}>
            <Loader2 className="animate-spin" size={14} /> …
          </p>
        )}
        {searchQ.trim().length >= 2 && (searchData?.hits?.length ?? 0) > 0 && (
          <ul className="settings-doc-search-hits">
            {searchData!.hits.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="settings-doc-search-hit"
                  onClick={() => {
                    setSelectedPath(h.path);
                    setSearchQ('');
                  }}
                >
                  <strong>
                    {h.path} L{h.startLine}–{h.endLine}
                  </strong>
                  <div style={{ marginTop: '0.2rem', opacity: 0.85 }}>{h.text.slice(0, 200)}…</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsIntegrationCard>

      <SettingsIntegrationCard title={t('ai.memory.editorTitle')} icon="description">
        <SettingsDocumentEditor
          files={files}
          filesLoading={filesLoading}
          selectedPath={selectedPath}
          onSelectPath={setSelectedPath}
          content={content}
          onChangeContent={setContent}
          fileLoading={fileLoading}
          onSave={() => saveMutation.mutate()}
          saving={saveMutation.isPending}
        />
      </SettingsIntegrationCard>
    </SettingsIntegrationShell>
  );
}
