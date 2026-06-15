import type { WAMessage } from '@whiskeysockets/baileys';
import { extractMessageContent, getContentType } from '@whiskeysockets/baileys';
import type { IncomingMessage } from '../interfaces/whatsapp-engine.interface';
import {
  defaultMimetypeForMessageType,
  isMediaMessageType,
  normalizeMessageType,
} from '../../common/utils/inbox-chat.util';

export type BaileysMediaDetails = {
  mimetype: string;
  filename?: string;
  thumbnailBase64?: string;
  width?: number;
  height?: number;
  caption?: string;
};

function bufferToBase64(data: Uint8Array | Buffer | null | undefined): string | undefined {
  if (!data?.length) return undefined;
  return Buffer.from(data).toString('base64');
}

/** WhatsApp embeds a low-res jpeg preview in most media messages. */
export function readBaileysMediaDetails(msg: WAMessage): BaileysMediaDetails | null {
  const content = msg.message ? extractMessageContent(msg.message) : undefined;
  const rawType = getContentType(content ?? undefined);
  if (!rawType) return null;

  const normalized = normalizeMessageType(rawType);
  if (!isMediaMessageType(normalized)) return null;

  if (rawType === 'imageMessage') {
    const image = content?.imageMessage;
    return {
      mimetype: image?.mimetype ?? defaultMimetypeForMessageType('image'),
      thumbnailBase64: bufferToBase64(image?.jpegThumbnail),
      width: image?.width ?? undefined,
      height: image?.height ?? undefined,
      caption: image?.caption ?? undefined,
    };
  }

  if (rawType === 'videoMessage') {
    const video = content?.videoMessage;
    return {
      mimetype: video?.mimetype ?? defaultMimetypeForMessageType('video'),
      thumbnailBase64: bufferToBase64(video?.jpegThumbnail),
      width: video?.width ?? undefined,
      height: video?.height ?? undefined,
      caption: video?.caption ?? undefined,
    };
  }

  if (rawType === 'stickerMessage') {
    const sticker = content?.stickerMessage;
    return {
      mimetype: sticker?.mimetype ?? 'image/webp',
      thumbnailBase64: bufferToBase64(sticker?.pngThumbnail),
      width: sticker?.width ?? undefined,
      height: sticker?.height ?? undefined,
    };
  }

  if (rawType === 'documentMessage') {
    const doc = content?.documentMessage;
    return {
      mimetype: doc?.mimetype ?? defaultMimetypeForMessageType('document'),
      filename: doc?.fileName ?? undefined,
      thumbnailBase64: bufferToBase64(doc?.jpegThumbnail),
      caption: doc?.caption ?? undefined,
    };
  }

  if (rawType === 'audioMessage') {
    const audio = content?.audioMessage;
    return {
      mimetype: audio?.mimetype ?? defaultMimetypeForMessageType('audio'),
    };
  }

  return {
    mimetype: defaultMimetypeForMessageType(normalized),
  };
}

/** Apply WhatsApp media fields (caption, thumbnail, dimensions) to an incoming message. */
export function applyBaileysMediaToIncoming(incoming: IncomingMessage, msg: WAMessage): void {
  const details = readBaileysMediaDetails(msg);
  if (!details) return;

  const caption = details.caption?.trim();
  if (caption && !incoming.body?.trim()) {
    incoming.body = caption;
  }

  incoming.media = {
    mimetype: details.mimetype,
    filename: details.filename,
    ...(details.thumbnailBase64 ? { thumbnail: details.thumbnailBase64 } : {}),
    ...(details.width ? { width: details.width } : {}),
    ...(details.height ? { height: details.height } : {}),
  };
}

export function thumbnailPreviewDataUrl(thumbnailBase64: string): string {
  return `data:image/jpeg;base64,${thumbnailBase64}`;
}
