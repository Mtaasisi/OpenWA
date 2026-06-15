import { thumbnailPreviewDataUrl } from './baileys-message-media.util';

describe('baileys-message-media.util', () => {
  it('builds a data URL for WhatsApp jpeg thumbnails', () => {
    expect(thumbnailPreviewDataUrl('abc123')).toBe('data:image/jpeg;base64,abc123');
  });
});
