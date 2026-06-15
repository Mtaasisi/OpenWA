import { useTranslation } from 'react-i18next';
import { LEAD_SOURCES, leadSourceLabel } from '../lib/lead-sources';
import type { ConversationSource } from '../services/api';
import './LeadSourceBadge.css';

interface Props {
  value: ConversationSource | string;
  onChange: (source: ConversationSource) => void;
  disabled?: boolean;
  className?: string;
}

export function LeadSourceSelect({ value, onChange, disabled, className }: Props) {
  const { t } = useTranslation();
  return (
    <select
      className={`lead-source-select ${className ?? ''}`.trim()}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value as ConversationSource)}
    >
      {LEAD_SOURCES.map(src => (
        <option key={src} value={src}>
          {leadSourceLabel(src, t)}
        </option>
      ))}
    </select>
  );
}
