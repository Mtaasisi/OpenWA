import { useTranslation } from 'react-i18next';

type Props = {
  side: 'list' | 'crm';
  active?: boolean;
  onPointerDown: (startX: number) => void;
};

export function InboxPanelResizeHandle({ side, active, onPointerDown }: Props) {
  const { t } = useTranslation();
  const label =
    side === 'list' ? t('inbox.resizeListPanel') : t('inbox.resizeCrmPanel');

  return (
    <div
      className={`inbox-panel-resize-handle inbox-panel-resize-handle--${side}${active ? ' is-active' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        onPointerDown(e.clientX);
      }}
    />
  );
}
