import { useTranslation } from 'react-i18next';
import { leadSourceColor, leadSourceLabel } from '../lib/lead-sources';
import './LeadSourceBadge.css';

interface Props {
  source: string | null | undefined;
  className?: string;
}

export function LeadSourceBadge({ source, className = '' }: Props) {
  const { t } = useTranslation();
  if (!source?.trim()) return null;
  const color = leadSourceColor(source);
  return (
    <span
      className={`lead-source-badge ${className}`.trim()}
      style={{ '--lead-source-color': color } as React.CSSProperties}
      title={leadSourceLabel(source, t)}
    >
      {leadSourceLabel(source, t)}
    </span>
  );
}
