import type { InboxMessage } from '../services/api';

const API_BASE_URL = '/api';

const MEDIA_TYPES = new Set(['image', 'sticker', 'video', 'audio', 'ptt', 'document']);

export const INBOX_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const INBOX_IMAGE_MAX_BYTES = 16 * 1024 * 1024;

export function isAllowedInboxImageFile(file: File): boolean {
  return (INBOX_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
}

export function getLocalPreviewUrl(message: InboxMessage): string | null {
  const meta = message.metadata as { localPreviewUrl?: string } | undefined;
  return meta?.localPreviewUrl ?? null;
}

export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function isMediaMessage(msg: InboxMessage): boolean {
  if (MEDIA_TYPES.has(msg.type)) return true;
  const meta = msg.metadata as { media?: { hasMedia?: boolean } } | undefined;
  return Boolean(meta?.media?.hasMedia ?? meta?.media);
}

export function mediaLabel(type: string): string {
  switch (type) {
    case 'image':
      return 'Image';
    case 'sticker':
      return 'Sticker';
    case 'video':
      return 'Video';
    case 'audio':
    case 'ptt':
      return 'Audio';
    case 'document':
      return 'Document';
    default:
      return type;
  }
}

export async function fetchMessageMediaBlob(sessionId: string, messageId: string): Promise<Blob | null> {
  const apiKey = sessionStorage.getItem('openwa_api_key');
  const url = `${API_BASE_URL}/sessions/${sessionId}/messages/${messageId}/media`;
  const response = await fetch(url, {
    headers: {
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
  });
  if (!response.ok) return null;
  return response.blob();
}
