import { useEffect, useRef, useState, type ReactNode } from 'react';

export type ActionMenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type ActionMenuProps = {
  trigger: ReactNode;
  items: ActionMenuItem[];
};

export function ActionMenu({ trigger, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="ws-action-menu" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {trigger}
      </button>
      {open && (
        <div className="ws-action-menu__dropdown" role="menu">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              className="ws-action-menu__item"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
