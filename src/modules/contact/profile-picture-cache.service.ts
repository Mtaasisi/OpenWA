import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { createLogger } from '../../common/services/logger.service';
import { phoneDigitsFromChatId } from '../../common/utils/inbox-display.util';
import { StorageService } from '../../common/storage/storage.service';
import { SessionService } from '../session/session.service';
import { SessionStatus } from '../session/entities/session.entity';
import { MessageService } from '../message/message.service';
import type { IWhatsAppEngine } from '../../engine/interfaces/whatsapp-engine.interface';

type CachedAvatar = {
  buffer: Buffer;
  contentType: string;
  cachedAt: number;
};

type AvatarMeta = {
  contentType?: string;
  cachedAt: number;
  absent?: boolean;
};

/** Re-fetch image bytes when online and cache is older than this. */
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** Retry "no profile photo" lookups after this (contacts may add photos later). */
const ABSENT_MS = 30 * 60 * 1000;
const MAX_BYTES = 512 * 1024;

@Injectable()
export class ProfilePictureCacheService {
  private readonly logger = createLogger('ProfilePictureCache');

  constructor(
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {}

  /** True when a recent lookup found no WhatsApp profile photo for this contact. */
  async isKnownAbsent(sessionId: string, contactId: string): Promise<boolean> {
    const meta = await this.readMeta(sessionId, contactId);
    return Boolean(meta?.absent && Date.now() - meta.cachedAt < ABSENT_MS);
  }

  /** Remember that WhatsApp has no profile photo for this contact (avoids repeat engine calls). */
  async markKnownAbsent(sessionId: string, contactId: string): Promise<void> {
    try {
      await this.writeAbsent(sessionId, contactId);
    } catch (error) {
      this.logger.debug(`Avatar absent cache write skipped for ${contactId}: ${String(error)}`);
    }
  }

  async getImage(
    sessionId: string,
    contactId: string,
    options: { forceRefresh?: boolean } = {},
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const meta = await this.readMeta(sessionId, contactId);
    if (
      meta?.absent &&
      Date.now() - meta.cachedAt < ABSENT_MS &&
      !options.forceRefresh
    ) {
      return null;
    }

    const cached = meta && !meta.absent ? await this.readImage(sessionId, contactId, meta) : null;
    const engine = this.sessionService.getEngine(sessionId);
    const session = await this.sessionService.findOne(sessionId);
    const sessionReady = session?.status === SessionStatus.READY;
    const stale = !cached || Date.now() - cached.cachedAt > REFRESH_MS;

    if (cached && !stale) {
      return { buffer: cached.buffer, contentType: cached.contentType };
    }

    if (!engine) {
      return cached ? { buffer: cached.buffer, contentType: cached.contentType } : null;
    }

    try {
      const fetched = await this.fetchFromEngine(sessionId, contactId, engine);
      if (!fetched) {
        if (sessionReady) {
          try {
            await this.writeAbsent(sessionId, contactId);
          } catch (error) {
            this.logger.debug(`Avatar absent cache write skipped for ${contactId}: ${String(error)}`);
          }
        }
        return cached ? { buffer: cached.buffer, contentType: cached.contentType } : null;
      }

      try {
        await this.write(sessionId, contactId, fetched.buffer, fetched.contentType);
      } catch (error) {
        this.logger.debug(`Avatar cache write skipped for ${contactId}: ${String(error)}`);
      }
      return fetched;
    } catch (error) {
      this.logger.debug(`Avatar fetch skipped for ${contactId}: ${String(error)}`);
      return cached ? { buffer: cached.buffer, contentType: cached.contentType } : null;
    }
  }

  /** Populate disk cache from a WhatsApp CDN URL (e.g. during inbox list enrichment). */
  async warmFromUrl(sessionId: string, contactId: string, url: string): Promise<void> {
    try {
      const meta = await this.readMeta(sessionId, contactId);
      if (meta && !meta.absent && Date.now() - meta.cachedAt < REFRESH_MS) return;

      const fetched = await this.fetchUrl(url);
      if (!fetched) return;

      await this.write(sessionId, contactId, fetched.buffer, fetched.contentType);
    } catch (error) {
      this.logger.debug(`Avatar warm skipped for ${contactId}: ${String(error)}`);
    }
  }

  private async fetchFromEngine(
    sessionId: string,
    contactId: string,
    engine: IWhatsAppEngine,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const candidates = await this.buildContactCandidates(sessionId, contactId, engine);

    for (const id of candidates) {
      if (engine.downloadProfilePicture) {
        try {
          const direct = await engine.downloadProfilePicture(id);
          if (direct?.buffer.length) return direct;
        } catch (error) {
          this.logger.debug(`Avatar session download failed for ${id}: ${String(error)}`);
        }
      }

      try {
        const url = await engine.getProfilePicture(id);
        if (!url) continue;
        const fetched = await this.fetchUrl(url);
        if (fetched) return fetched;
      } catch (error) {
        this.logger.debug(`Avatar URL fetch failed for ${id}: ${String(error)}`);
      }
    }

    return null;
  }

  private async buildContactCandidates(
    sessionId: string,
    contactId: string,
    engine?: IWhatsAppEngine,
  ): Promise<string[]> {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const add = (id?: string | null) => {
      const trimmed = id?.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      candidates.push(trimmed);
    };

    add(contactId);

    const fromChat = phoneDigitsFromChatId(contactId);
    if (fromChat) add(`${fromChat}@c.us`);

    if (contactId.endsWith('@lid') && engine) {
      try {
        const contact = await engine.getContactById(contactId);
        if (contact?.number) {
          const digits = contact.number.replace(/\D/g, '');
          if (digits) add(`${digits}@c.us`);
        }
      } catch {
        /* contact not in WA store yet */
      }
    }

    try {
      const phoneHint = await this.messageService.resolveThreadPhoneHint(sessionId, contactId);
      if (phoneHint) add(`${phoneHint}@c.us`);
    } catch {
      /* best-effort */
    }

    return candidates;
  }

  private async fetchUrl(
    url: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    return { buffer, contentType };
  }

  private cachePaths(sessionId: string, contactId: string): { image: string; meta: string } {
    const key = Buffer.from(contactId, 'utf8').toString('base64url');
    const base = `avatars/${sessionId}/${key}`;
    return { image: `${base}.bin`, meta: `${base}.json` };
  }

  private async readMeta(sessionId: string, contactId: string): Promise<AvatarMeta | null> {
    const { meta } = this.cachePaths(sessionId, contactId);
    try {
      const metaRaw = await this.storageService.getFile(meta);
      const parsed = JSON.parse(metaRaw.toString('utf8')) as AvatarMeta;
      if (!parsed?.cachedAt) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async readImage(
    sessionId: string,
    contactId: string,
    meta: AvatarMeta,
  ): Promise<CachedAvatar | null> {
    if (!meta.contentType || meta.absent) return null;
    const { image } = this.cachePaths(sessionId, contactId);
    try {
      const buffer = await this.storageService.getFile(image);
      return {
        buffer,
        contentType: meta.contentType,
        cachedAt: meta.cachedAt,
      };
    } catch {
      return null;
    }
  }

  private async write(
    sessionId: string,
    contactId: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const { image, meta } = this.cachePaths(sessionId, contactId);
    const metaPayload: AvatarMeta = {
      contentType,
      cachedAt: Date.now(),
      absent: false,
    };
    await this.storageService.putFile(image, buffer);
    await this.storageService.putFile(meta, Buffer.from(JSON.stringify(metaPayload), 'utf8'));
  }

  private async writeAbsent(sessionId: string, contactId: string): Promise<void> {
    const { meta } = this.cachePaths(sessionId, contactId);
    const metaPayload: AvatarMeta = {
      cachedAt: Date.now(),
      absent: true,
    };
    await this.storageService.putFile(meta, Buffer.from(JSON.stringify(metaPayload), 'utf8'));
  }
}
