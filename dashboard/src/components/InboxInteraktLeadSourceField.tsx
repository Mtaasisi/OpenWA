import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import './InboxInteraktLeadSourceField.css';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import {
  LEAD_SOURCES,
  leadSourceColor,
  leadSourceIcon,
  leadSourceLabel,
} from '../lib/lead-sources';
import type { ConversationSource } from '../services/api';

interface Props {
  source: ConversationSource | string;
  canEdit?: boolean;
  disabled?: boolean;
  onChange?: (source: ConversationSource) => void;
  className?: string;
}

export function InboxInteraktLeadSourceField({
  source,
  canEdit = false,
  disabled = false,
  onChange,
  className,
}: Props) {
  const { t } = useTranslation();
  const resolved = source?.trim() || 'whatsapp';
  const color = leadSourceColor(resolved);
  const icon = leadSourceIcon(resolved);
  const label = leadSourceLabel(resolved, t);
  const editable = canEdit && !!onChange;
  const showChevron = !disabled && editable;

  return (
    <div
      className={`inbox-interakt-lead-source${editable ? ' inbox-interakt-lead-source--editable' : ''}${disabled ? ' inbox-interakt-lead-source--disabled' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--lead-source-color': color } as CSSProperties}
    >
      <div className="inbox-interakt-lead-source__pill">
        <span className="inbox-interakt-lead-source__face" aria-hidden>
          <MaterialSymbol name={icon} size={14} className="inbox-interakt-lead-source__icon" />
          <span className="inbox-interakt-lead-source__label">{label}</span>
          {editable && disabled ? (
            <Loader2 className="inbox-interakt-lead-source__spinner animate-spin" size={12} />
          ) : showChevron ? (
            <MaterialSymbol
              name="expand_more"
              size={14}
              className="inbox-interakt-lead-source__chevron"
            />
          ) : null}
        </span>
        {editable && (
          <select
            className="inbox-interakt-lead-source__select"
            value={resolved}
            disabled={disabled}
            aria-label={t('leadSources.label')}
            onChange={e => onChange!(e.target.value as ConversationSource)}
          >
            {LEAD_SOURCES.map(src => (
              <option key={src} value={src}>
                {leadSourceLabel(src, t)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
