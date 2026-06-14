const VISION_MODEL_PATTERNS = [
  /gpt-4o/i,
  /gpt-4\.1/i,
  /gemini-2/i,
  /gemini-1\.5/i,
  /claude-3/i,
  /claude-sonnet-4/i,
  /claude-opus-4/i,
  /qwen.*vl/i,
  /llava/i,
  /vision/i,
];

export function isVisionCapableModel(model: string): boolean {
  return VISION_MODEL_PATTERNS.some(p => p.test(model));
}

export interface ChatImageAttachment {
  mimeType: string;
  data: string;
}

export function buildMultimodalUserContent(
  text: string,
  images: ChatImageAttachment[],
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  if (!images.length) return text;
  const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: text || 'Describe this image in the context of our shop.' },
  ];
  for (const img of images.slice(0, 4)) {
    const mime = img.mimeType?.startsWith('image/') ? img.mimeType : 'image/jpeg';
    const b64 = img.data.replace(/^data:image\/\w+;base64,/, '');
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${b64}` },
    });
  }
  return parts;
}
