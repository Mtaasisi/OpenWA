import type { InboxMessage } from '../services/api';
import { getAuthHeaders } from '../lib/auth-storage';
import {
  getCachedAvatarStatus,
  putCachedAvatarAbsent,
} from '../lib/inbox-avatar-cache';

const API_BASE_URL = '/api';
const MEDIA_FETCH_TIMEOUT_MS = 20_000;
const AVATAR_FETCH_TIMEOUT_MS = 8_000;
const AVATAR_RETRY_DELAYS_MS = [0, 2_000, 5_000];
const MEDIA_RETRY_DELAYS_MS = [0, 2_000, 4_000, 8_000];

const MEDIA_TYPES = new Set(['image', 'sticker', 'video', 'audio', 'ptt', 'document']);

/** Map Baileys/proto content types (e.g. imageMessage) to inbox message types (image). */
export function normalizeMessageType(type: string): string {
  switch (type) {
    case 'imageMessage':
      return 'image';
    case 'videoMessage':
      return 'video';
    case 'audioMessage':
      return 'audio';
    case 'documentMessage':
      return 'document';
    case 'stickerMessage':
      return 'sticker';
    case 'extendedTextMessage':
    case 'conversation':
      return 'chat';
    default:
      if (type.endsWith('Message')) {
        const stem = type.slice(0, -'Message'.length).toLowerCase();
        if (MEDIA_TYPES.has(stem)) return stem;
      }
      return type;
  }
}

export function isMediaMessageType(type: string): boolean {
  return MEDIA_TYPES.has(normalizeMessageType(type));
}

/** Hide caption text that duplicates the media placeholder (legacy raw proto types). */
export function isRedundantMediaCaption(message: InboxMessage, body: string): boolean {
  const text = body.trim();
  if (!text || !isMediaMessage(message)) return false;
  const normalized = normalizeMessageType(message.type);
  if (text === message.type || text === normalized) return true;
  if (text === mediaLabel(message.type)) return true;
  const bracket = /^\[(.+)\]$/.exec(text);
  if (bracket && normalizeMessageType(bracket[1]) === normalized) return true;
  return false;
}

export const INBOX_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const INBOX_IMAGE_MAX_BYTES = 16 * 1024 * 1024;

export function isAllowedInboxImageFile(file: File): boolean {
  return (INBOX_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
}

export function getLocalPreviewUrl(message: InboxMessage): string | null {
  const meta = message.metadata as {
    localPreviewUrl?: string;
    media?: { thumbnailPreview?: string };
  } | undefined;
  return meta?.localPreviewUrl ?? meta?.media?.thumbnailPreview ?? null;
}

export function getMessageMediaDimensions(message: InboxMessage): { width?: number; height?: number } {
  const meta = message.metadata as { media?: { width?: number; height?: number } } | undefined;
  return { width: meta?.media?.width, height: meta?.media?.height };
}

const PREVIEW_MAX_WIDTH = 400;
const PREVIEW_MAX_HEIGHT = 480;
const PREVIEW_DEFAULT_MIN_WIDTH = 280;
const PREVIEW_DEFAULT_MIN_HEIGHT = 200;

export type MediaPreviewFrameStyle = {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
};

/** Low-res WhatsApp thumbnail shown before full media bytes are available. */
export function shouldShowBlurredMediaPreview(message: InboxMessage, fullMediaUrl: string | null): boolean {
  if (fullMediaUrl) return false;
  const meta = message.metadata as { optimistic?: boolean } | undefined;
  if (meta?.optimistic) return false;
  if (!getLocalPreviewUrl(message)) return false;
  return needsManualMediaDownload(message) || isMessageMediaDownloading(message);
}

/** Size the blurred preview frame to match the original media aspect ratio. */
function getMediaPreviewFrameStyleForBounds(
  message: InboxMessage,
  maxWidth: number,
  maxHeight: number,
  defaultMinWidth: number,
  defaultMinHeight: number,
): MediaPreviewFrameStyle {
  const { width, height } = getMessageMediaDimensions(message);
  if (!width || !height || width <= 0 || height <= 0) {
    return {
      minWidth: defaultMinWidth,
      minHeight: defaultMinHeight,
    };
  }
  let w = width;
  let h = height;
  if (w > maxWidth) {
    h = (maxWidth / w) * h;
    w = maxWidth;
  }
  if (h > maxHeight) {
    w = (maxHeight / h) * w;
    h = maxHeight;
  }
  return {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
  };
}

export function getMediaPreviewFrameStyle(message: InboxMessage): MediaPreviewFrameStyle {
  return getMediaPreviewFrameStyleForBounds(
    message,
    PREVIEW_MAX_WIDTH,
    PREVIEW_MAX_HEIGHT,
    PREVIEW_DEFAULT_MIN_WIDTH,
    PREVIEW_DEFAULT_MIN_HEIGHT,
  );
}

export function getMediaLightboxPreviewFrameStyle(message: InboxMessage): MediaPreviewFrameStyle {
  return getMediaPreviewFrameStyleForBounds(message, 820, 620, 320, 280);
}

export function getMessageMediaMimetype(message: InboxMessage): string | null {
  const meta = message.metadata as { media?: { mimetype?: string } } | undefined;
  const mime = meta?.media?.mimetype?.trim();
  return mime || null;
}

/** Ensure blob has a displayable mime type and non-zero size before creating an object URL. */
export function normalizeMediaBlob(blob: Blob, fallbackMime?: string | null): Blob | null {
  if (!blob || blob.size === 0) return null;
  const mime = (blob.type || fallbackMime || '').split(';')[0].trim();
  if (!mime) return blob;
  if (blob.type) return blob;
  return new Blob([blob], { type: mime });
}

export function createMediaObjectUrl(blob: Blob, fallbackMime?: string | null): string | null {
  const normalized = normalizeMediaBlob(blob, fallbackMime);
  if (!normalized) return null;
  return URL.createObjectURL(normalized);
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
  if (isMediaMessageType(msg.type)) return true;
  const meta = msg.metadata as { media?: { hasMedia?: boolean } } | undefined;
  return Boolean(meta?.media?.hasMedia ?? meta?.media);
}

/** Session that owns persisted media bytes (may differ from active inbox filter). */
export function resolveMediaSessionId(message: InboxMessage, fallbackSessionId: string): string {
  return message.sessionId?.trim() || fallbackSessionId;
}

export function getMessageMediaStatus(message: InboxMessage): string | null {
  const meta = message.metadata as { media?: { mediaStatus?: string; storagePath?: string } } | undefined;
  if (meta?.media?.storagePath) return 'downloaded';
  return meta?.media?.mediaStatus ?? null;
}

export function isMessageMediaDownloading(message: InboxMessage): boolean {
  return getMessageMediaStatus(message) === 'downloading';
}

export function needsManualMediaDownload(message: InboxMessage): boolean {
  const status = getMessageMediaStatus(message);
  return status === 'not_downloaded' || status === 'failed';
}

export function shouldFetchMessageMedia(message: InboxMessage): boolean {
  if (message.id.startsWith('pending-')) return false;
  const meta = message.metadata as {
    optimistic?: boolean;
    localPreviewUrl?: string;
    media?: { mediaStatus?: string };
  } | undefined;
  if (meta?.optimistic) return false;
  if (meta?.localPreviewUrl) return false;
  if (meta?.media?.mediaStatus === 'not_downloaded') return false;
  if (meta?.media?.mediaStatus === 'deleted') return false;
  if (meta?.media?.mediaStatus === 'downloading') return false;
  return isMediaMessage(message);
}

export function isMessageMediaStarred(message: InboxMessage): boolean {
  const meta = message.metadata as { media?: { starred?: boolean } } | undefined;
  return meta?.media?.starred === true;
}

export async function setMessageMediaStarred(messageId: string, starred: boolean): Promise<boolean> {
  const authHeaders = getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/storage/media/${messageId}/star`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ starred }),
  });
  return response.ok;
}

export async function requestManualMediaDownload(messageId: string): Promise<boolean> {
  const authHeaders = getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/storage/media/${messageId}/download`, {
    method: 'POST',
    headers: {
      ...authHeaders,
    },
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as { ok?: boolean };
  return payload.ok === true;
}

const MEDIA_DOWNLOAD_POLL_MS = 2500;

/** Poll server until background media download finishes (WhatsApp auto-download). */
export function startMediaDownloadPoll(
  sessionId: string,
  messageId: string,
  options: {
    isCancelled?: () => boolean;
    fallbackMime?: string | null;
    onBlob: (blob: Blob) => void;
  },
): () => void {
  let cancelled = false;
  const isCancelled = () => cancelled || options.isCancelled?.() === true;

  const poll = () => {
    void loadMessageMediaBlob(sessionId, messageId, {
      isCancelled,
      fallbackMime: options.fallbackMime,
    }).then(blob => {
      if (blob && !isCancelled()) options.onBlob(blob);
    });
  };

  poll();
  const timer = window.setInterval(poll, MEDIA_DOWNLOAD_POLL_MS);
  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
}

export function isImagePreviewMessage(msg: InboxMessage): boolean {
  const normalized = normalizeMessageType(msg.type);
  if (normalized === 'image' || normalized === 'sticker') return true;
  const mime = (msg.metadata as { media?: { mimetype?: string } } | undefined)?.media?.mimetype;
  return Boolean(mime?.startsWith('image/'));
}

export function mediaLabel(type: string): string {
  switch (normalizeMessageType(type)) {
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
      return normalizeMessageType(type);
  }
}

const unavailableMediaKeys = new Set<string>();
const unavailableAvatarKeys = new Set<string>();

function mediaCacheKey(sessionId: string, messageId: string): string {
  return `${sessionId}:${messageId}`;
}

function avatarCacheKey(sessionId: string, contactId: string): string {
  return `${sessionId}:${contactId}`;
}

export function isMessageMediaKnownUnavailable(sessionId: string, messageId: string): boolean {
  return unavailableMediaKeys.has(mediaCacheKey(sessionId, messageId));
}

function markMessageMediaUnavailable(sessionId: string, messageId: string): void {
  unavailableMediaKeys.add(mediaCacheKey(sessionId, messageId));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchMessageMediaBlob(sessionId: string, messageId: string): Promise<Blob | null> {
  const key = mediaCacheKey(sessionId, messageId);
  if (unavailableMediaKeys.has(key)) return null;

  const authHeaders = getAuthHeaders();
  const url = `${API_BASE_URL}/sessions/${sessionId}/messages/${messageId}/media`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        ...authHeaders,
      },
      signal: controller.signal,
    });
    if (response.status === 404) {
      return null;
    }
    // 204 = not cached yet; allow retries while background download runs.
    if (response.status === 204) return null;
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Fetch media with short retries while the server caches WhatsApp attachments. */
export async function loadMessageMediaBlob(
  sessionId: string,
  messageId: string,
  options: { isCancelled?: () => boolean; fallbackMime?: string | null } = {},
): Promise<Blob | null> {
  if (isMessageMediaKnownUnavailable(sessionId, messageId)) return null;

  let saw204Only = true;
  for (let i = 0; i < MEDIA_RETRY_DELAYS_MS.length; i += 1) {
    if (options.isCancelled?.()) return null;
    const delay = MEDIA_RETRY_DELAYS_MS[i];
    if (delay > 0) await sleep(delay);
    if (options.isCancelled?.()) return null;

    const result = await fetchMessageMediaBlobWithStatus(sessionId, messageId);
    if (result.blob) {
      saw204Only = false;
      return normalizeMediaBlob(
        result.blob,
        result.contentType || options.fallbackMime,
      );
    }
    if (result.status !== 204) {
      saw204Only = false;
    }
  }

  // 204 may mean not downloaded yet or policy-blocked — do not mark permanently unavailable.
  if (!saw204Only) {
    markMessageMediaUnavailable(sessionId, messageId);
  }
  return null;
}

export function revokeTrackedObjectUrl(objectUrlRef: { current: string | null }): void {
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }
}

async function fetchMessageMediaBlobWithStatus(
  sessionId: string,
  messageId: string,
): Promise<{ blob: Blob | null; status: number; contentType: string | null }> {
  const key = mediaCacheKey(sessionId, messageId);
  if (unavailableMediaKeys.has(key)) return { blob: null, status: 404, contentType: null };

  const authHeaders = getAuthHeaders();
  const url = `${API_BASE_URL}/sessions/${sessionId}/messages/${messageId}/media`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        ...authHeaders,
      },
      signal: controller.signal,
    });
    const contentType = response.headers.get('Content-Type');
    if (response.status === 404) {
      return { blob: null, status: 404, contentType };
    }
    if (response.status === 204) return { blob: null, status: 204, contentType };
    if (!response.ok) return { blob: null, status: response.status, contentType };
    return { blob: await response.blob(), status: 200, contentType };
  } catch {
    return { blob: null, status: 0, contentType: null };
  } finally {
    window.clearTimeout(timer);
  }
}

function markContactAvatarUnavailable(sessionId: string, contactId: string): void {
  unavailableAvatarKeys.add(avatarCacheKey(sessionId, contactId));
  void putCachedAvatarAbsent(sessionId, contactId);
}

export function isContactAvatarKnownUnavailable(sessionId: string, contactId: string): boolean {
  return unavailableAvatarKeys.has(avatarCacheKey(sessionId, contactId));
}

export type FetchContactAvatarOptions = {
  /** CDN URL on conversation — ignore stale local absent cache. */
  hasProfilePicHint?: boolean;
};

async function fetchContactAvatarBlobOnce(
  sessionId: string,
  contactId: string,
  options: FetchContactAvatarOptions = {},
): Promise<{ blob: Blob | null; status: number; absentConfirmed: boolean }> {
  const authHeaders = getAuthHeaders();
  const refreshQuery = options.hasProfilePicHint ? '?refresh=1' : '';
  const url = `${API_BASE_URL}/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}/profile-picture/image${refreshQuery}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), AVATAR_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        ...authHeaders,
      },
      signal: controller.signal,
    });
    const absentConfirmed = response.headers.get('X-Avatar-Absent') === 'true';
    if (response.status === 204 || response.status === 404) {
      return { blob: null, status: response.status, absentConfirmed };
    }
    if (!response.ok) return { blob: null, status: response.status, absentConfirmed: false };
    return { blob: await response.blob(), status: 200, absentConfirmed: false };
  } catch {
    return { blob: null, status: 0, absentConfirmed: false };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchContactAvatarBlob(
  sessionId: string,
  contactId: string,
  options: FetchContactAvatarOptions = {},
): Promise<Blob | null> {
  const key = avatarCacheKey(sessionId, contactId);
  const hasProfilePicHint = options.hasProfilePicHint ?? false;

  if (!hasProfilePicHint && unavailableAvatarKeys.has(key)) return null;

  if (!hasProfilePicHint) {
    const cachedStatus = await getCachedAvatarStatus(sessionId, contactId);
    if (cachedStatus === 'absent') {
      unavailableAvatarKeys.add(key);
      return null;
    }
  } else {
    unavailableAvatarKeys.delete(key);
  }

  let absentConfirmed = false;
  for (let attempt = 0; attempt < AVATAR_RETRY_DELAYS_MS.length; attempt++) {
    const delay = AVATAR_RETRY_DELAYS_MS[attempt];
    if (delay > 0) {
      await new Promise(resolve => window.setTimeout(resolve, delay));
    }

    const result = await fetchContactAvatarBlobOnce(sessionId, contactId, options);
    if (result.blob) {
      unavailableAvatarKeys.delete(key);
      return result.blob;
    }

    absentConfirmed = result.absentConfirmed;
    if (absentConfirmed) break;
    if (result.status !== 204) break;
  }

  if (absentConfirmed && !hasProfilePicHint) {
    markContactAvatarUnavailable(sessionId, contactId);
  }
  return null;
}
