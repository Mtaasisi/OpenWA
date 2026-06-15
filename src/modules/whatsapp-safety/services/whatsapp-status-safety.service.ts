import { BadRequestException, Injectable } from '@nestjs/common';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';

@Injectable()
export class WhatsAppStatusSafetyService {
  constructor(private readonly settingsService: WhatsAppSafetySettingsService) {}

  async assertStatusPostAllowed(sessionId: string): Promise<void> {
    const settings = await this.settingsService.getForSession(sessionId);
    if (!settings.statusPostsEnabled) {
      throw new BadRequestException(
        'WhatsApp status/story posts are disabled. Enable "Status / story posts" in Settings → WhatsApp Safety.',
      );
    }
  }
}
