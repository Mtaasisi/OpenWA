import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { aiApi } from '../../../services/api';
import { extractWhatsAppChatFromZip } from '../../../lib/learning-zip';
import { useToast } from '../../Toast';
import { SettingsIntegrationCard, SettingsIntField } from '../SettingsIntegrationShell';

function importFormatForFile(file: File): 'csv' | 'archive' {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.zip')) return 'archive';
  return 'csv';
}

export function AiLearningImportSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceName, setSourceName] = useState('whatsapp-export');

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ['ai-learning', 'imports'],
    queryFn: () => aiApi.listLearningImports(),
  });

  const promoteFaqMutation = useMutation({
    mutationFn: (importId: string) => aiApi.promoteLearningToFaq(importId),
    onSuccess: res => {
      toast.success(t('ai.learning.promotedFaq', { count: res.added, path: res.path }));
      void qc.invalidateQueries({ queryKey: ['ai-knowledge'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const promoteExamplesMutation = useMutation({
    mutationFn: (importId: string) => aiApi.promoteLearningToExamples(importId),
    onSuccess: res => {
      toast.success(t('ai.learning.promotedExamples', { count: res.added, path: res.path }));
      void qc.invalidateQueries({ queryKey: ['ai-knowledge'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const name = file.name.toLowerCase();
      let content: string;
      let fileName = file.name;
      if (name.endsWith('.zip')) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const extracted = extractWhatsAppChatFromZip(bytes);
        content = extracted.content;
        fileName = extracted.fileName;
      } else {
        content = await file.text();
      }
      const format = importFormatForFile(file);
      return aiApi.importLearningFile(
        sourceName.trim() || file.name,
        content,
        fileName,
        format === 'archive' || name.endsWith('.zip') ? 'archive' : 'csv',
      );
    },
    onSuccess: res => {
      toast.success(
        t('ai.learning.importDone', { rows: res.importedRows, questions: res.questionCount }),
      );
      void qc.invalidateQueries({ queryKey: ['ai-learning'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const latest = imports[0];

  return (
    <SettingsIntegrationCard title={t('ai.learning.importSectionTitle')} className="ail-import-section">
      <SettingsIntField label={t('ai.learning.sourceName')}>
        <input
          className="settings-int-input"
          value={sourceName}
          onChange={e => setSourceName(e.target.value)}
        />
      </SettingsIntField>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,.zip"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) importMutation.mutate(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="settings-int-btn"
        disabled={importMutation.isPending}
        onClick={() => fileRef.current?.click()}
      >
        {importMutation.isPending ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
        {t('ai.learning.chooseFile')}
      </button>
      <p className="settings-int-hint">{t('ai.learning.fileHint')}</p>
      {isLoading ? (
        <Loader2 className="spin" size={20} />
      ) : imports.length === 0 ? (
        <p>{t('ai.learning.noImports')}</p>
      ) : (
        <ul className="settings-int-list">
          {imports.slice(0, 5).map(imp => (
            <li key={imp.id}>
              {imp.sourceName} — {t('ai.learning.status', { status: imp.status })}
            </li>
          ))}
        </ul>
      )}
      {latest?.status === 'complete' && (
        <div className="settings-int-btn-row">
          <button
            type="button"
            className="settings-int-btn settings-int-btn--secondary"
            disabled={promoteFaqMutation.isPending}
            onClick={() => promoteFaqMutation.mutate(latest.id)}
          >
            {t('ai.learning.promoteFaq')}
          </button>
          <button
            type="button"
            className="settings-int-btn settings-int-btn--secondary"
            disabled={promoteExamplesMutation.isPending}
            onClick={() => promoteExamplesMutation.mutate(latest.id)}
          >
            {t('ai.learning.promoteExamples')}
          </button>
        </div>
      )}
    </SettingsIntegrationCard>
  );
}
