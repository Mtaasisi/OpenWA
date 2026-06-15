import { BadRequestException, Injectable } from '@nestjs/common';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';

@Injectable()
export class WhatsAppGroupSafetyService {
  constructor(private readonly settingsService: WhatsAppSafetySettingsService) {}

  async assertGroupManagementAllowed(
    sessionId: string,
    options?: { confirm?: boolean },
  ): Promise<void> {
    const settings = await this.settingsService.getForSession(sessionId);
    if (!settings.groupManagementEnabled) {
      throw new BadRequestException(
        'Group management is disabled. Enable it in Settings → WhatsApp Safety → Policy Guard.',
      );
    }
    if (options?.confirm !== true) {
      throw new BadRequestException(
        'This group action requires explicit confirmation. Pass { "confirm": true } in the request body.',
      );
    }
  }
}
