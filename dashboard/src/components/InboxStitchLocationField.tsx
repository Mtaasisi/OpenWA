import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import {
  TANZANIA_ALL_REGIONS,
  TANZANIA_OTHER_REGIONS,
  TANZANIA_POPULAR_REGIONS,
} from '../lib/tanzania-regions';

interface Props {
  value: string;
  canEdit?: boolean;
  disabled?: boolean;
  onChange?: (region: string) => void;
}

export function InboxStitchLocationField({
  value,
  canEdit = false,
  disabled = false,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const editable = canEdit && !!onChange;
  const showChevron = editable && !disabled;
  const label = value?.trim() || '—';

  return (
    <div
      className={`inbox-stitch-c360-location-field${editable ? ' inbox-stitch-c360-location-field--editable' : ''}${disabled ? ' inbox-stitch-c360-location-field--disabled' : ''}`}
    >
      <div className="inbox-stitch-c360-location-field__face">
        <span className="inbox-stitch-c360-location-field__label">{label}</span>
        {editable && disabled ? (
          <Loader2 className="inbox-stitch-c360-location-field__spinner animate-spin" size={12} />
        ) : showChevron ? (
          <MaterialSymbol name="expand_more" size={18} className="inbox-stitch-c360-location-field__chevron" />
        ) : null}
      </div>
      {editable ? (
        <select
          className="inbox-stitch-c360-location-field__select"
          value={value}
          disabled={disabled}
          aria-label={t('inbox.stitch.location')}
          onChange={e => onChange?.(e.target.value)}
        >
          <option value="">{t('inbox.stitch.locationPlaceholder')}</option>
          <optgroup label={t('inbox.stitch.popularRegions')}>
            {TANZANIA_POPULAR_REGIONS.map(region => (
              <option key={`popular-${region}`} value={region}>
                {region}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('inbox.stitch.allRegions')}>
            {TANZANIA_OTHER_REGIONS.map(region => (
              <option key={`region-${region}`} value={region}>
                {region}
              </option>
            ))}
          </optgroup>
          {value && !(TANZANIA_ALL_REGIONS as readonly string[]).includes(value) ? (
            <option value={value}>{value}</option>
          ) : null}
        </select>
      ) : null}
    </div>
  );
}
