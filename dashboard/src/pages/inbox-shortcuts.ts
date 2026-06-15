/** Primary modifier label for shortcut hints (⌘ on Apple, Ctrl on others). */
export function inboxModKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? '⌘' : 'Ctrl';
}

export function isInboxEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

export function isInboxModKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}
