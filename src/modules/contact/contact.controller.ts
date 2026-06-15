import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Res,
  StreamableFile,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SessionService } from '../session/session.service';
import { SessionStatus } from '../session/entities/session.entity';
import { ProfilePictureCacheService } from './profile-picture-cache.service';
import { InboxThreadSummaryService } from '../message/inbox-thread-summary.service';
import { MessageService } from '../message/message.service';
import { resolveLargeAccountScale } from '../message/large-account.util';
import { isPlausiblePhoneDigits } from '../../common/utils/inbox-display.util';

@ApiTags('contacts')
@Controller('sessions/:sessionId/contacts')
export class ContactController {
  constructor(
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly profilePictureCache: ProfilePictureCacheService,
    private readonly inboxThreadSummaryService: InboxThreadSummaryService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'List of contacts (or empty list when large-account guard is active)',
  })
  @ApiResponse({ status: 400, description: 'Session not ready' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async findAll(@Param('sessionId') sessionId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }

    const scale = await resolveLargeAccountScale(
      this.inboxThreadSummaryService,
      this.configService,
      [sessionId],
    );
    if (scale.largeAccountMode) {
      return {
        contacts: [],
        largeAccountMode: true,
        threadTotal: scale.threadTotal,
        hint: 'Full contact sync is disabled for large accounts. Use inbox thread search instead.',
      };
    }

    const contacts = await engine.getContacts();
    return { contacts, largeAccountMode: false, threadTotal: scale.threadTotal };
  }

  @Get('check/:number')
  @ApiOperation({ summary: 'Check if a phone number exists on WhatsApp' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'number', description: 'Phone number to check (e.g., 628123456789)' })
  @ApiResponse({
    status: 200,
    description: 'Number existence check result',
  })
  async checkNumber(@Param('sessionId') sessionId: string, @Param('number') number: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    const exists = await engine.checkNumberExists(number);
    return {
      number,
      exists,
      whatsappId: exists ? `${number}@c.us` : null,
    };
  }

  @Get(':contactId/profile-picture')
  @ApiOperation({ summary: 'Get profile picture URL for a contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({
    status: 200,
    description: 'Profile picture URL',
  })
  async getProfilePicture(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    const decodedId = decodeURIComponent(contactId);
    const url = await engine.getProfilePicture(decodedId);
    return { url };
  }

  @Get(':contactId/profile-picture/image')
  @ApiOperation({ summary: 'Stream profile picture bytes for a contact or chat' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact or chat ID (e.g., 628xxx@c.us)' })
  @ApiResponse({ status: 200, description: 'Profile picture image' })
  @ApiResponse({ status: 204, description: 'No profile picture available' })
  async getProfilePictureImage(
    @Param('sessionId') sessionId: string,
    @Param('contactId') contactId: string,
    @Query('refresh') refresh: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | void> {
    try {
      const decodedId = decodeURIComponent(contactId);
      const forceRefresh = refresh === '1' || refresh === 'true';
      const cached = await this.profilePictureCache.getImage(sessionId, decodedId, { forceRefresh });
      if (cached) {
        return new StreamableFile(cached.buffer, {
          type: cached.contentType,
          disposition: 'inline',
        });
      }

      const session = await this.sessionService.findOne(sessionId);
      const sessionReady = session?.status === SessionStatus.READY;
      const knownAbsent = await this.profilePictureCache.isKnownAbsent(sessionId, decodedId);
      if (sessionReady && knownAbsent) {
        res.setHeader('X-Avatar-Absent', 'true');
      }
      res.status(HttpStatus.NO_CONTENT);
    } catch {
      res.status(HttpStatus.NO_CONTENT);
    }
  }

  @Post(':contactId/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block a contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({
    status: 200,
    description: 'Contact blocked',
  })
  async blockContact(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    await engine.blockContact(contactId);
    return { success: true, message: 'Contact blocked' };
  }

  @Delete(':contactId/block')
  @ApiOperation({ summary: 'Unblock a contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({
    status: 200,
    description: 'Contact unblocked',
  })
  async unblockContact(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new Error('Session is not started');
    }
    await engine.unblockContact(contactId);
    return { success: true, message: 'Contact unblocked' };
  }

  @Get(':contactId/presence')
  @ApiOperation({ summary: 'Get online presence for a contact' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({
    status: 200,
    description: 'Contact presence (online/offline/unknown)',
  })
  async getContactPresence(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException('Session is not started');
    }
    const decodedId = decodeURIComponent(contactId);
    return engine.getContactPresence(decodedId);
  }

  @Get(':contactId')
  @ApiOperation({ summary: 'Get a specific contact by ID' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID (e.g., 628xxx@c.us)' })
  @ApiResponse({
    status: 200,
    description: 'Contact details',
  })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException('Session is not started');
    }
    const decodedId = decodeURIComponent(contactId);
    let contact = await engine.getContactById(decodedId);

    const contactDigits = contact?.number?.replace(/\D/g, '') ?? '';
    const needsPhoneHint = !contact || !isPlausiblePhoneDigits(contactDigits);
    if (needsPhoneHint) {
      const hint = await this.messageService.resolveThreadPhoneHint(sessionId, decodedId);
      if (hint) {
        contact = {
          id: decodedId,
          name: contact?.name,
          pushName: contact?.pushName,
          number: hint,
          isMyContact: contact?.isMyContact ?? false,
          isBlocked: contact?.isBlocked ?? false,
        };
      }
    }

    if (!contact) {
      throw new NotFoundException(`Contact ${decodedId} not found`);
    }
    return contact;
  }
}
