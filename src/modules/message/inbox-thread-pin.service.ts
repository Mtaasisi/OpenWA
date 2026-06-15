import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboxThreadPin } from './entities/inbox-thread-pin.entity';
import { isInboxChat } from '../../common/utils/inbox-chat.util';

export type InboxThreadPinDto = {
  sessionId: string;
  chatId: string;
  label?: string | null;
  pinnedAt?: string;
};

const MAX_PINS = 24;

@Injectable()
export class InboxThreadPinService {
  constructor(
    @InjectRepository(InboxThreadPin, 'data')
    private readonly repo: Repository<InboxThreadPin>,
  ) {}

  async listForStaff(staffId: string): Promise<InboxThreadPinDto[]> {
    const rows = await this.repo.find({
      where: { staffId },
      order: { pinnedAt: 'DESC' },
      take: MAX_PINS,
    });
    return rows.map(row => this.toDto(row));
  }

  async toggle(
    staffId: string,
    sessionId: string,
    chatId: string,
    label?: string | null,
  ): Promise<{ pinned: boolean; pins: InboxThreadPinDto[] }> {
    this.assertValidThread(sessionId, chatId);
    const existing = await this.repo.findOne({ where: { staffId, sessionId, chatId } });
    if (existing) {
      await this.repo.delete(existing.id);
      return { pinned: false, pins: await this.listForStaff(staffId) };
    }

    const count = await this.repo.count({ where: { staffId } });
    if (count >= MAX_PINS) {
      throw new BadRequestException(`Maximum ${MAX_PINS} pinned chats allowed`);
    }

    await this.repo.save(
      this.repo.create({
        staffId,
        sessionId,
        chatId,
        label: label?.trim() || null,
        pinnedAt: new Date(),
      }),
    );
    return { pinned: true, pins: await this.listForStaff(staffId) };
  }

  async replaceAll(
    staffId: string,
    pins: InboxThreadPinDto[],
  ): Promise<InboxThreadPinDto[]> {
    const normalized = pins
      .filter(p => p.sessionId?.trim() && p.chatId?.trim() && isInboxChat(p.chatId))
      .slice(0, MAX_PINS);

    await this.repo.delete({ staffId });
    if (normalized.length === 0) {
      return [];
    }

    const now = Date.now();
    await this.repo.save(
      normalized.map((pin, index) =>
        this.repo.create({
          staffId,
          sessionId: pin.sessionId.trim(),
          chatId: pin.chatId.trim(),
          label: pin.label?.trim() || null,
          pinnedAt: new Date(now - index),
        }),
      ),
    );
    return this.listForStaff(staffId);
  }

  private assertValidThread(sessionId: string, chatId: string): void {
    if (!sessionId?.trim() || !chatId?.trim()) {
      throw new BadRequestException('sessionId and chatId are required');
    }
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Invalid chat id');
    }
  }

  private toDto(row: InboxThreadPin): InboxThreadPinDto {
    return {
      sessionId: row.sessionId,
      chatId: row.chatId,
      label: row.label,
      pinnedAt: row.pinnedAt.toISOString(),
    };
  }
}
