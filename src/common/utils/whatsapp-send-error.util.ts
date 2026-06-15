import { ServiceUnavailableException } from '@nestjs/common';

const BROWSER_GONE =
  /detached Frame|Target closed|Session closed|Protocol error|browser has disconnected/i;

export function isWhatsAppBrowserDetachedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return BROWSER_GONE.test(msg);
}

/** Map raw engine/puppeteer failures to a user-facing HTTP error (503). */
export function rethrowWhatsAppSendError(error: unknown): never {
  if (error instanceof ServiceUnavailableException) {
    throw error;
  }

  const msg = error instanceof Error ? error.message : String(error);

  if (isWhatsAppBrowserDetachedError(error)) {
    throw new ServiceUnavailableException(
      'WHATSAPP_CONNECTION_LOST: WhatsApp disconnected on this computer. Open Sessions, stop and start your account, then try again.',
    );
  }

  if (/WhatsApp client is not ready/i.test(msg)) {
    throw new ServiceUnavailableException(
      'SESSION_NOT_READY: WhatsApp is not connected. Start the session from Sessions first.',
    );
  }

  if (error instanceof Error) {
    throw error;
  }
  throw new Error(msg);
}
