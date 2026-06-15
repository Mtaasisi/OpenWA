import type { ReactNode } from 'react';
import { Menu, X } from 'lucide-react';

type TopBarProps = {
  isOpen: boolean;
  onToggle: () => void;
  brandName: string;
  expandLabel: string;
  actions?: ReactNode;
};

export function TopBar({ isOpen, onToggle, brandName, expandLabel, actions }: TopBarProps) {
  return (
    <header className="mobile-header">
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={onToggle}
        aria-label={expandLabel}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      <div className="mobile-brand">
        <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
        <span className="brand-name">{brandName}</span>
      </div>
      {actions ?? <div style={{ width: 40 }} />}
    </header>
  );
}
