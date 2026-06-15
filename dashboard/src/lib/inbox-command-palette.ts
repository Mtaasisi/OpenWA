export const OPENWA_COMMAND_PALETTE_EVENT = 'openwa-command-palette';

export function dispatchOpenCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(OPENWA_COMMAND_PALETTE_EVENT));
}
