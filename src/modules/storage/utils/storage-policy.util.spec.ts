import { shouldAutoDownloadMedia, defaultChatTypeSettings } from './storage-policy.util';

describe('storage-policy.util', () => {
  it('auto-downloads direct customer images by default', () => {
    const settings = {
      ...defaultChatTypeSettings('direct_customer'),
      maxAutoDownloadSizeMb: 5,
      keepMediaDays: 90,
      excludeStarredMediaFromCleanup: true,
      allowGroupAutoDownload: false,
      manualDownloadOnlyForGroups: true,
    };
    expect(
      shouldAutoDownloadMedia({
        chatType: 'direct_customer',
        messageType: 'image',
        settings,
      }),
    ).toBe(true);
  });

  it('blocks group media by default', () => {
    const settings = {
      ...defaultChatTypeSettings('group'),
      maxAutoDownloadSizeMb: 5,
      keepMediaDays: 90,
      excludeStarredMediaFromCleanup: true,
      allowGroupAutoDownload: false,
      manualDownloadOnlyForGroups: true,
    };
    expect(
      shouldAutoDownloadMedia({
        chatType: 'group',
        messageType: 'image',
        settings,
      }),
    ).toBe(false);
  });

  it('always allows outbound media', () => {
    const settings = {
      ...defaultChatTypeSettings('group'),
      maxAutoDownloadSizeMb: 5,
      keepMediaDays: 90,
      excludeStarredMediaFromCleanup: true,
      allowGroupAutoDownload: false,
      manualDownloadOnlyForGroups: true,
    };
    expect(
      shouldAutoDownloadMedia({
        chatType: 'group',
        messageType: 'video',
        settings,
        fromMe: true,
      }),
    ).toBe(true);
  });
});
