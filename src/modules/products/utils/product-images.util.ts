import type { Product } from '../entities/product.entity';

/** WhatsApp media caption limit. */
export const WHATSAPP_CAPTION_MAX_LENGTH = 1024;

export function resolveProductImageUrls(
  product: Pick<Product, 'imageUrl' | 'imageUrls'>,
): string[] {
  const gallery = (product.imageUrls ?? [])
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url));
  if (gallery.length > 0) {
    return [...new Set(gallery)];
  }
  const single = product.imageUrl?.trim();
  return single ? [single] : [];
}

export function truncateWhatsAppCaption(text: string, maxLength = WHATSAPP_CAPTION_MAX_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}
