import type { LucideIcon } from 'lucide-react';
import { isValidElement, type ReactNode } from 'react';

/** Lucide icons are ForwardRef objects ({ $$typeof, render }), not plain functions. */
export function renderIconSlot(
  icon: LucideIcon | ReactNode | undefined,
  size = 20,
  className?: string,
): ReactNode {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const Icon = icon as LucideIcon;
  return <Icon size={size} className={className} aria-hidden />;
}
