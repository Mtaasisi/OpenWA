import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../../services/api';
import { useToast } from '../Toast';

type RagField = 'knowledgeRagEnabled' | 'memoryRagEnabled';

type Props = {
  field: RagField;
  labelKey: string;
  hintKey: string;
};

export function AiRagFeatureToggle({ field, labelKey, hintKey }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiApi.getConfig(),
  });

  const enabled = config?.[field] !== false;

  const mutation = useMutation({
    mutationFn: (next: boolean) => aiApi.saveConfig({ [field]: next }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-config'] });
      toast.success(t('ai.settings.saved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <label className="ai-settings-check-row ai-rag-feature-toggle">
      <input
        type="checkbox"
        checked={enabled}
        disabled={mutation.isPending || config == null}
        onChange={e => mutation.mutate(e.target.checked)}
      />
      <div>
        <div className="ai-settings-check-row__title">{t(labelKey)}</div>
        <p className="ai-settings-check-row__hint">{t(hintKey)}</p>
      </div>
    </label>
  );
}
