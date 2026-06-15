import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';

export type StitchGenderValue = 'male' | 'female' | null;

interface Props {
  value: StitchGenderValue;
  canEdit?: boolean;
  disabled?: boolean;
  onChange?: (value: StitchGenderValue) => void;
}

function normalizeGender(value: string | null | undefined): StitchGenderValue {
  const raw = value?.trim().toLowerCase();
  if (raw === 'male' || raw === 'man' || raw === 'm') return 'male';
  if (raw === 'female' || raw === 'woman' || raw === 'f') return 'female';
  return null;
}

export function stitchGenderFromLabel(label: string | null | undefined): StitchGenderValue {
  return normalizeGender(label);
}

export function stitchGenderToLabel(value: StitchGenderValue): string | null {
  if (value === 'male') return 'Male';
  if (value === 'female') return 'Female';
  return null;
}

export function InboxStitchGenderField({
  value,
  canEdit = false,
  disabled = false,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const editable = canEdit && !!onChange;
  const pending = editable && disabled;

  const options: Array<{ id: StitchGenderValue; icon: string; label: string }> = [
    { id: 'male', icon: 'male', label: t('inbox.stitch.genderMale') },
    { id: 'female', icon: 'female', label: t('inbox.stitch.genderFemale') },
  ];

  const active = options.find(option => option.id === value);

  if (!editable) {
    if (!active) {
      return <p className="inbox-stitch-c360-field__value">—</p>;
    }
    return (
      <div className="inbox-stitch-c360-gender-field inbox-stitch-c360-gender-field--selected">
        <span className="inbox-stitch-c360-gender-field__label">{active.label}</span>
      </div>
    );
  }

  const showPicker = !value || pickerOpen;

  if (!showPicker && active) {
    return (
      <div
        className={[
          'inbox-stitch-c360-gender-field',
          'inbox-stitch-c360-gender-field--selected',
          'inbox-stitch-c360-gender-field--editable',
          pending ? 'inbox-stitch-c360-gender-field--disabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          className="inbox-stitch-c360-gender-field__face"
          disabled={pending}
          aria-label={t('inbox.stitch.gender')}
          onClick={() => setPickerOpen(true)}
        >
          <span className="inbox-stitch-c360-gender-field__label">{active.label}</span>
          {pending ? (
            <Loader2 className="inbox-stitch-c360-gender-field__spinner animate-spin" size={12} />
          ) : (
            <MaterialSymbol name="expand_more" size={18} className="inbox-stitch-c360-gender-field__chevron" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        'inbox-stitch-c360-gender-field',
        pending ? 'inbox-stitch-c360-gender-field--pending' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={t('inbox.stitch.gender')}
    >
      {options.map(option => {
        const isActive = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={`inbox-stitch-c360-gender-field__option${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            title={option.label}
            disabled={pending}
            onClick={() => {
              onChange?.(option.id);
              setPickerOpen(false);
            }}
          >
            <MaterialSymbol
              name={option.icon}
              size={16}
              weight={400}
              className="inbox-stitch-c360-gender-field__icon"
            />
            <span>{option.label}</span>
          </button>
        );
      })}
      {pending ? <Loader2 className="inbox-stitch-c360-gender-field__spinner animate-spin" size={14} /> : null}
    </div>
  );
}
