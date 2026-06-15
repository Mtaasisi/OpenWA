import { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import type { FollowupSortKey, FollowupViewChip } from './followup-utils';
import { AUTOPILOT_CHIPS, isAutopilotChip } from './followup-utils';

type Props = {
  activeChip: FollowupViewChip;
  onChipChange: (chip: FollowupViewChip) => void;
  sortKey: FollowupSortKey;
  onSortChange: (key: FollowupSortKey) => void;
  autopilotCounts?: Partial<Record<string, number>>;
  variant?: 'classic' | 'stitch';
};

const CHIPS: FollowupViewChip[] = ['my', 'team', 'due_today', 'overdue', 'upcoming'];
const SORT_OPTIONS: FollowupSortKey[] = ['priority', 'due', 'customer'];

export function FollowupViewChips({
  activeChip,
  onChipChange,
  sortKey,
  onSortChange,
  autopilotCounts,
  variant = 'classic',
}: Props) {
  const { t } = useTranslation();
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sortOpen]);

  const autopilotTotal = useMemo(
    () =>
      (Object.values(autopilotCounts ?? {}) as number[]).reduce(
        (sum, n) => sum + (n ?? 0),
        0,
      ),
    [autopilotCounts],
  );
  const autopilotChipActive = isAutopilotChip(activeChip);
  const [autopilotOpen, setAutopilotOpen] = useState(autopilotTotal > 0 || autopilotChipActive);

  useEffect(() => {
    if (autopilotChipActive) setAutopilotOpen(true);
  }, [autopilotChipActive]);

  const autopilotChips = (
    <div className="fu-chips fu-chips--autopilot">
      {AUTOPILOT_CHIPS.map(chip => {
        const count = autopilotCounts?.[chip];
        return (
          <button
            key={chip}
            type="button"
            className={['fu-chip', activeChip === chip ? 'fu-chip--active' : ''].filter(Boolean).join(' ')}
            onClick={() => onChipChange(chip)}
          >
            {t(`followups.viewChipsAutopilot.${chip}`, {
              defaultValue: chip.replace(/_/g, ' '),
            })}
            {count != null && count > 0 ? ` (${count})` : ''}
          </button>
        );
      })}
    </div>
  );

  const sortControl = (
    <div className="fu-sort fu-sort-wrap" ref={sortRef}>
      <span>{t('followups.sortedBy')}</span>
      <button
        type="button"
        className="fu-sort__btn"
        onClick={() => setSortOpen(v => !v)}
      >
        {t(`followups.sort.${sortKey}`)}
        <MaterialSymbol name="expand_more" size={16} />
      </button>
      {sortOpen && (
        <div className="fu-sort__menu">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              className={[
                'fu-sort__option',
                sortKey === opt ? 'fu-sort__option--active' : '',
              ].join(' ')}
              onClick={() => {
                onSortChange(opt);
                setSortOpen(false);
              }}
            >
              {t(`followups.sort.${opt}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (variant === 'stitch') {
    return (
      <div className="followups-stitch-chips">
        <div className="followups-stitch-chips__main">
          <div className="fu-chips">
            {CHIPS.map(chip => (
              <button
                key={chip}
                type="button"
                className={[
                  'fu-chip',
                  activeChip === chip ? 'fu-chip--active' : '',
                  chip === 'overdue' && activeChip !== chip ? 'fu-chip--danger' : '',
                  chip === 'overdue' && activeChip === chip ? 'fu-chip--danger fu-chip--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onChipChange(chip)}
              >
                {t(`followups.viewChips.${chip}`)}
              </button>
            ))}
          </div>
          {sortControl}
        </div>
        <div
          className={[
            'followups-stitch-chips__autopilot',
            autopilotOpen ? 'is-open' : 'is-collapsed',
          ].join(' ')}
        >
          <button
            type="button"
            className="followups-stitch-chips__toggle"
            onClick={() => setAutopilotOpen(open => !open)}
            aria-expanded={autopilotOpen}
          >
            <span className="followups-stitch-chips__label">
              {t('followups.stitch.autopilot')}
            </span>
            {autopilotTotal > 0 ? (
              <span className="followups-stitch-chips__badge">{autopilotTotal}</span>
            ) : null}
            <MaterialSymbol
              name={autopilotOpen ? 'expand_less' : 'expand_more'}
              size={18}
              className="followups-stitch-chips__chevron"
            />
          </button>
          {autopilotOpen ? autopilotChips : null}
        </div>
      </div>
    );
  }

  return (
    <div className="fu-view-row">
      <div className="fu-chips">
        {CHIPS.map(chip => (
          <button
            key={chip}
            type="button"
            className={[
              'fu-chip',
              activeChip === chip ? 'fu-chip--active' : '',
              chip === 'overdue' && activeChip !== chip ? 'fu-chip--danger' : '',
              chip === 'overdue' && activeChip === chip ? 'fu-chip--danger fu-chip--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChipChange(chip)}
          >
            {t(`followups.viewChips.${chip}`)}
          </button>
        ))}
      </div>
      <div className="fu-chips fu-chips--autopilot">
        {AUTOPILOT_CHIPS.map(chip => {
          const count = autopilotCounts?.[chip];
          return (
            <button
              key={chip}
              type="button"
              className={['fu-chip', activeChip === chip ? 'fu-chip--active' : ''].filter(Boolean).join(' ')}
              onClick={() => onChipChange(chip)}
            >
              {t(`followups.viewChipsAutopilot.${chip}`, {
                defaultValue: chip.replace(/_/g, ' '),
              })}
              {count != null && count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
      {sortControl}
    </div>
  );
}
