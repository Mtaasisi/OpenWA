import { EventEmitter } from 'events';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import * as path from 'path';
import {
  IWhatsAppEngine,
  EngineStatus,
  EngineEventCallbacks,
  MessageResult,
  MediaInput,
  IncomingMessage,
  Contact,
  Group,
  GroupInfo,
  GroupParticipant,
  LocationInput,
  ContactCard,
  ContactPresence,
  MessageReaction,
  Label,
  Channel,
  ChannelMessage,
  Status,
  TextStatusOptions,
  StatusResult,
  Catalog,
  Product,
  ProductQueryOptions,
  PaginatedProducts,
} from '../interfaces/whatsapp-engine.interface';
import { createLogger } from '../../common/services/logger.service';
import { isWhatsAppBrowserDetachedError } from '../../common/utils/whatsapp-send-error.util';
import {
  GroupChat,
  MessageWithReactions,
  BusinessClient,
  WwjsChannelData,
  GroupCreateResult,
} from '../types/whatsapp-web-js.types';
import type { ChatSummary } from '../interfaces/whatsapp-engine.interface';
import { isInboxChat, shouldPersistMessage } from '../../common/utils/inbox-chat.util';
import { isUsableWhatsAppChatTitle } from '../../common/utils/inbox-display.util';

export interface WhatsAppWebJsConfig {
  sessionId: string;
  sessionDataPath: string;
  puppeteer?: {
    headless?: boolean;
    args?: string[];
  };
  /** Skip heavy getChat/getContact during bulk history sync after scan */
  syncWindowMs?: number;
  // Phase 3: Proxy per session
  proxy?: {
    url: string;
    type: 'http' | 'https' | 'socks4' | 'socks5';
  };
}

export class WhatsAppWebJsAdapter extends EventEmitter implements IWhatsAppEngine {
  private client: Client | null = null;
  private status: EngineStatus = EngineStatus.DISCONNECTED;
  private qrCode: string | null = null;
  private phoneNumber: string | null = null;
  private pushName: string | null = null;
  private callbacks: EngineEventCallbacks = {};
  private syncWindowUntil = 0;
  constructor(private readonly config: WhatsAppWebJsConfig) {
    super();
  }

  private readonly logger = createLogger('WhatsAppWebJsAdapter');

  async initialize(callbacks: EngineEventCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.setStatus(EngineStatus.INITIALIZING);

    try {
      // Build puppeteer args, including proxy if configured
      const puppeteerArgs = this.config.puppeteer?.args || [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ]

      // Add proxy configuration if provided
      if (this.config.proxy) {
        puppeteerArgs.push(`--proxy-server=${this.config.proxy.url}`);
        this.logger.log(
          `Using proxy: ${this.config.proxy.type}://${this.config.proxy.url.replace(/:[^:@]*@/, ':***@')}`,
        );
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: this.config.sessionId,
          dataPath: path.resolve(this.config.sessionDataPath),
        }),
        puppeteer: {
          headless: this.config.puppeteer?.headless ?? true,
          args: puppeteerArgs,
        },
      });

      this.setupEventHandlers();
      await this.client.initialize();
    } catch (error) {
      this.setStatus(EngineStatus.FAILED);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.client.on('qr', async (qr: string) => {
      try {
        this.qrCode = await qrcode.toDataURL(qr);
        this.setStatus(EngineStatus.QR_READY);
        this.callbacks.onQRCode?.(this.qrCode);
      } catch (error) {
        this.logger.error('Error generating QR code', String(error));
      }
    });

    this.client.on('authenticated', () => {
      const syncWindowMs = this.config.syncWindowMs ?? 300_000;
      this.syncWindowUntil = Date.now() + syncWindowMs;
      this.setStatus(EngineStatus.AUTHENTICATING);
      this.qrCode = null;
    });

    this.client.on('loading_screen', (percent: string | number, message: string) => {
      if (this.status !== EngineStatus.LOADING_CHATS && this.status !== EngineStatus.READY) {
        this.setStatus(EngineStatus.LOADING_CHATS);
      }
      const numeric = typeof percent === 'string' ? parseFloat(percent) : percent;
      this.callbacks.onLoadingProgress?.(Number.isFinite(numeric) ? numeric : 0, message ?? '');
    });

    this.client.on('ready', () => {
      try {
        const info = this.client?.info;
        this.phoneNumber = info?.wid?.user || null;
        this.pushName = info?.pushname || null;
        this.callbacks.onReady?.(this.phoneNumber || '', this.pushName || '');
        this.setStatus(EngineStatus.READY);
      } catch (error) {
        this.logger.error('Error getting client info', String(error));
        this.callbacks.onReady?.('', '');
        this.setStatus(EngineStatus.READY);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.client.on('message', async msg => {
      try {
        const inSyncWindow = Date.now() < this.syncWindowUntil;
        let chatId: string;
        let isGroup: boolean;
        let chatName: string | undefined;

        if (inSyncWindow) {
          chatId = msg.from.includes('@g.us') ? msg.from : msg.fromMe ? msg.to : msg.from;
          isGroup = chatId.includes('@g.us');
        } else {
          const chat = await msg.getChat();
          chatId = chat.id._serialized;
          isGroup = chat.isGroup;
          chatName = chat.name;
        }

        if (!isInboxChat(chatId)) {
          return;
        }

        const groupAuthor =
          isGroup && !msg.fromMe && msg.author ? String(msg.author) : undefined;

        const incomingMessage: IncomingMessage = {
          id: msg.id._serialized,
          from: groupAuthor ?? msg.from,
          to: msg.to,
          chatId,
          body: msg.body,
          type: msg.type,
          timestamp: msg.timestamp,
          fromMe: msg.fromMe,
          isGroup,
          author: groupAuthor,
          chatName,
          broadcast: Boolean(msg.broadcast),
          isStatus: Boolean(msg.isStatus),
        };

        // Media bytes are fetched on demand via downloadMessageMedia (avoids blocking receive path)
        if (msg.hasMedia) {
          incomingMessage.media = {
            mimetype: this.guessMimetypeFromMessage(msg),
            filename: undefined,
            data: undefined,
          };
        }

        // Handle quoted message
        if (!inSyncWindow && msg.hasQuotedMsg) {
          try {
            const quoted = await msg.getQuotedMessage();
            incomingMessage.quotedMessage = {
              id: quoted.id._serialized,
              body: quoted.body,
            };
          } catch (error) {
            this.logger.debug('Could not load quoted message', { error: String(error) });
          }
        }

        if (!inSyncWindow && !msg.fromMe) {
          try {
            const contact = await msg.getContact();
            const push = (contact?.pushname || contact?.name || '')?.trim();
            if (push) incomingMessage.notifyName = push;
          } catch {
            /* contact not in store yet */
          }
        }

        this.callbacks.onMessage?.(incomingMessage);
      } catch (error) {
        this.logger.error('Error processing incoming message', String(error));
      }
    });

    this.client.on('message_ack', (msg, ack) => {
      this.callbacks.onMessageAck?.(msg.id._serialized, ack);
    });

    this.client.on('unread_count', chat => {
      try {
        const chatId = chat.id._serialized;
        if (isInboxChat(chatId)) {
          this.callbacks.onUnreadCountChanged?.(chatId, chat.unreadCount ?? 0);
        }
      } catch (error) {
        this.logger.debug('Error handling unread_count', { error: String(error) });
      }
    });

    this.client.on('disconnected', reason => {
      this.setStatus(EngineStatus.DISCONNECTED);
      this.callbacks.onDisconnected?.(reason);
    });

    this.client.on('auth_failure', () => {
      this.setStatus(EngineStatus.FAILED);
      this.callbacks.onAuthFailure?.('Authentication failed');
    });
  }

  private setStatus(status: EngineStatus): void {
    this.status = status;
    this.callbacks.onStateChanged?.(status);
    this.emit('stateChanged', status);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        // Use destroy instead of logout to preserve session data
        // This allows reconnecting without needing to scan QR again
        await this.client.destroy();
      } catch (error) {
        this.logger.warn('Destroy client failed:', String(error));
        // Already destroyed or not initialized - ignore
      }
      this.client = null;
      this.setStatus(EngineStatus.DISCONNECTED);
    }
  }

  async logout(): Promise<void> {
    if (this.client) {
      try {
        // Logout clears session data - user will need to scan QR again
        await this.client.logout();
      } catch (error) {
        this.logger.warn('Logout failed:', String(error));
        // Fall back to destroy if logout fails
        try {
          await this.client.destroy();
        } catch (destroyError) {
          this.logger.warn('Client destroy also failed during logout fallback', String(destroyError));
        }
      }
      this.client = null;
      this.setStatus(EngineStatus.DISCONNECTED);
    }
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.setStatus(EngineStatus.DISCONNECTED);
    }
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  getQRCode(): string | null {
    return this.qrCode;
  }

  getPhoneNumber(): string | null {
    return this.phoneNumber;
  }

  getPushName(): string | null {
    return this.pushName;
  }

  async sendTextMessage(chatId: string, text: string): Promise<MessageResult> {
    this.ensureReady();
    const msg = await this.withBrowserSend(() => this.client!.sendMessage(chatId, text));
    return {
      id: msg.id._serialized,
      timestamp: msg.timestamp,
    };
  }

  async sendImageMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media);
  }

  async sendImageAlbum(chatId: string, imageUrls: string[], caption?: string): Promise<MessageResult[]> {
    this.ensureReady();
    const urls = imageUrls.map((url) => url?.trim()).filter(Boolean);
    if (urls.length === 0) {
      throw new Error('At least one image URL is required');
    }

    const results: MessageResult[] = [];
    for (let index = 0; index < urls.length; index++) {
      const isLast = index === urls.length - 1;
      const messageMedia = await MessageMedia.fromUrl(urls[index]);
      const msg = await this.client!.sendMessage(chatId, messageMedia, {
        caption: isLast ? caption : undefined,
        sendSeen: isLast,
      });
      results.push({
        id: msg.id._serialized,
        timestamp: msg.timestamp,
      });
    }
    return results;
  }

  async sendVideoMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media);
  }

  async sendAudioMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media);
  }

  async sendDocumentMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media);
  }

  private async sendMediaMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    this.ensureReady();

    let messageMedia: MessageMedia;

    if (typeof media.data === 'string') {
      if (media.data.startsWith('http://') || media.data.startsWith('https://')) {
        // URL
        messageMedia = await MessageMedia.fromUrl(media.data);
      } else {
        // Base64
        messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
      }
    } else {
      // Buffer
      messageMedia = new MessageMedia(media.mimetype, media.data.toString('base64'), media.filename);
    }

    const quotedMsg = await this.resolveQuotedMessage(chatId, media.quotedMessageId);
    const msg = await this.withBrowserSend(() =>
      this.client!.sendMessage(chatId, messageMedia, {
        caption: media.caption,
        ...(quotedMsg ? { quotedMessageId: quotedMsg.id._serialized } : {}),
      }),
    );

    return {
      id: msg.id._serialized,
      timestamp: msg.timestamp,
    };
  }

  private async resolveQuotedMessage(chatId: string, quotedMsgId?: string) {
    if (!quotedMsgId?.trim()) return undefined;
    try {
      const byId = await this.client!.getMessageById(quotedMsgId);
      if (byId) return byId;
    } catch {
      // fall through to chat history lookup
    }
    const chat = await this.client!.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    return messages.find(m => m.id._serialized === quotedMsgId);
  }

  async getContacts(): Promise<Contact[]> {
    this.ensureReady();
    const contacts = await this.client!.getContacts();

    return contacts.map(c => ({
      id: c.id._serialized,
      name: c.name || undefined,
      pushName: c.pushname || undefined,
      number: c.number,
      isMyContact: c.isMyContact,
      isBlocked: c.isBlocked,
    }));
  }

  async getContactById(contactId: string): Promise<Contact | null> {
    this.ensureReady();
    try {
      const contact = await this.client!.getContactById(contactId);
      return {
        id: contact.id._serialized,
        name: contact.name || undefined,
        pushName: contact.pushname || undefined,
        number: contact.number,
        isMyContact: contact.isMyContact,
        isBlocked: contact.isBlocked,
      };
    } catch (error) {
      this.logger.warn(`Failed to get contact: ${contactId}`, String(error));
      return null;
    }
  }

  async getContactPresence(contactId: string): Promise<ContactPresence> {
    this.ensureReady();
    if (!this.client?.pupPage) {
      return { chatId: contactId, state: 'unknown' };
    }

    try {
      const result = await this.client.pupPage.evaluate(async (id: string) => {
        type PresencePayload = {
          type?: string | null;
          lastSeen?: number | null;
          error?: string;
        };

        const readPresence = async (): Promise<PresencePayload> => {
          const widFactory = (window as unknown as { require: (name: string) => any }).require(
            'WAWebWidFactory',
          );
          const wid = widFactory.createWid(id);

          const collectionModule = (window as unknown as { require: (name: string) => any }).require(
            'WAWebPresenceCollection',
          );
          const collection = collectionModule?.PresenceCollection ?? collectionModule;
          if (collection?.findImpl || collection?.get || collection?.find) {
            if (typeof collection.subscribe === 'function') {
              await collection.subscribe(wid);
            } else if (typeof collection.subscribePresence === 'function') {
              await collection.subscribePresence(wid);
            }
            const model =
              (typeof collection.get === 'function' ? collection.get(wid) : null) ??
              (typeof collection.find === 'function' ? collection.find(wid) : null);
            const chatstate = model?.chatstate ?? model?.__x_chatstate;
            const type = chatstate?.type ?? model?.presence?.type ?? model?.state ?? null;
            const lastSeenRaw = model?.lastSeen ?? chatstate?.lastSeen ?? null;
            const lastSeen =
              lastSeenRaw == null ? null : Number(lastSeenRaw) > 1_000_000_000_000
                ? Math.floor(Number(lastSeenRaw) / 1000)
                : Number(lastSeenRaw);
            return { type, lastSeen };
          }

          return { type: null, lastSeen: null };
        };

        try {
          return await readPresence();
        } catch (err) {
          return { error: String(err) };
        }
      }, contactId);

      if (!result || result.error || !result.type) {
        return { chatId: contactId, state: 'unknown' };
      }

      const type = String(result.type).toLowerCase();
      let state: ContactPresence['state'] = 'unknown';
      if (type === 'available' || type === 'composing' || type === 'recording') {
        state = 'online';
      } else if (type === 'unavailable' || type === 'paused') {
        state = 'offline';
      }

      return {
        chatId: contactId,
        state,
        lastSeenAt:
          result.lastSeen != null && Number.isFinite(result.lastSeen)
            ? new Date(result.lastSeen * 1000).toISOString()
            : null,
      };
    } catch (error) {
      this.logger.warn(`Failed to read presence: ${contactId}`, String(error));
      return { chatId: contactId, state: 'unknown' };
    }
  }

  async checkNumberExists(number: string): Promise<boolean> {
    this.ensureReady();
    const numberId = await this.client!.getNumberId(number);
    return numberId !== null;
  }

  async listChats(): Promise<ChatSummary[]> {
    this.ensureReady();
    const chats = await this.client!.getChats();

    return chats
      .filter(chat => isInboxChat(chat.id._serialized))
      .map(chat => {
        const chatId = chat.id._serialized;
        const rawName = chat.name?.trim() ?? '';
        const name = isUsableWhatsAppChatTitle(rawName, chatId) ? rawName : '';
        return {
          chatId,
          name,
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          lastMessageAt: chat.timestamp,
        };
      });
  }

  async fetchChatMessages(chatId: string, limit = 50): Promise<IncomingMessage[]> {
    this.ensureReady();
    if (!isInboxChat(chatId) || !this.client) {
      return [];
    }

    try {
      const chat = await this.client.getChatById(chatId);
      const raw = await chat.fetchMessages({ limit: Math.min(Math.max(limit, 1), 100) });
      const isGroup = chat.isGroup;
      const chatName = chat.name;

      return raw
        .map(msg => {
          const groupAuthor =
            isGroup && !msg.fromMe && msg.author ? String(msg.author) : undefined;
          const incoming: IncomingMessage = {
            id: msg.id._serialized,
            from: groupAuthor ?? msg.from,
            to: msg.to,
            chatId,
            body: msg.body,
            type: msg.type,
            timestamp: msg.timestamp,
            fromMe: msg.fromMe,
            isGroup,
            author: groupAuthor,
            chatName,
            broadcast: Boolean(msg.broadcast),
            isStatus: Boolean(msg.isStatus),
          };
          if (msg.hasMedia) {
            incoming.media = {
              mimetype: this.guessMimetypeFromMessage(msg),
              filename: undefined,
              data: undefined,
            };
          }
          return incoming;
        })
        .filter(msg => isInboxChat(msg.chatId) && shouldPersistMessage(msg));
    } catch (error) {
      this.logger.debug(`fetchChatMessages failed for ${chatId}`, { error: String(error) });
      return [];
    }
  }

  async markChatRead(chatId: string): Promise<void> {
    this.ensureReady();
    if (!isInboxChat(chatId)) {
      throw new Error('Cannot mark this chat type as read');
    }
    const chat = await this.client!.getChatById(chatId);
    await chat.sendSeen();
  }

  async sendTyping(chatId: string): Promise<void> {
    this.ensureReady();
    if (!isInboxChat(chatId)) return;
    const chat = await this.client!.getChatById(chatId);
    await chat.sendStateTyping();
  }

  async clearTyping(chatId: string): Promise<void> {
    if ((this.status !== EngineStatus.READY && this.status !== EngineStatus.LOADING_CHATS) || !this.client) return;
    if (!isInboxChat(chatId)) return;
    try {
      const chat = await this.client.getChatById(chatId);
      await chat.clearState();
    } catch {
      // Chat may have been deleted or client disconnected
    }
  }

  async downloadMessageMedia(
    waMessageId: string,
  ): Promise<{ mimetype: string; data: Buffer; filename?: string } | null> {
    if (
      (this.status !== EngineStatus.READY && this.status !== EngineStatus.LOADING_CHATS) ||
      !this.client
    ) {
      return null;
    }
    try {
      const msg = await this.client!.getMessageById(waMessageId);
      if (!msg.hasMedia) return null;
      const media = await msg.downloadMedia();
      if (!media?.data) return null;
      return {
        mimetype: media.mimetype || this.guessMimetypeFromMessage(msg),
        data: Buffer.from(media.data, 'base64'),
        filename: media.filename ?? undefined,
      };
    } catch (error) {
      this.logger.warn('downloadMessageMedia failed', { waMessageId, error: String(error) });
      return null;
    }
  }

  private guessMimetypeFromMessage(msg: { type: string; hasMedia?: boolean }): string {
    const type = msg.type || 'document';
    if (type === 'image' || type === 'sticker') return 'image/jpeg';
    if (type === 'video') return 'video/mp4';
    if (type === 'audio' || type === 'ptt') return 'audio/ogg';
    if (type === 'document') return 'application/octet-stream';
    return 'application/octet-stream';
  }

  async getGroups(): Promise<Group[]> {
    this.ensureReady();
    const chats = await this.client!.getChats();

    const groups = chats.filter(chat => chat.isGroup);

    return groups.map(g => {
      const groupChat = g as unknown as GroupChat;
      return {
        id: g.id._serialized,
        name: g.name,
        participantsCount: groupChat.participants?.length,
        isAdmin: groupChat.participants?.some(
          p => p.isAdmin && p.id._serialized === this.client?.info?.wid?._serialized,
        ),
      };
    });
  }

  // ============= Phase 3: Extended Messaging =============

  async sendLocationMessage(chatId: string, location: LocationInput): Promise<MessageResult> {
    this.ensureReady();
    // Import Location class dynamically from whatsapp-web.js
    const { Location } = await import('whatsapp-web.js');
    const loc = new Location(location.latitude, location.longitude, {
      name: location.description || '',
      address: location.address || '',
    });
    const msg = await this.client!.sendMessage(chatId, loc);
    return {
      id: msg.id._serialized,
      timestamp: msg.timestamp,
    };
  }

  async sendContactMessage(chatId: string, contact: ContactCard): Promise<MessageResult> {
    this.ensureReady();
    // Create vCard format
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contact.name}`,
      `TEL;type=CELL;type=VOICE;waid=${contact.number}:+${contact.number}`,
      'END:VCARD',
    ].join('\n');

    const msg = await this.client!.sendMessage(chatId, vcard, {
      parseVCards: true,
    });
    return {
      id: msg.id._serialized,
      timestamp: msg.timestamp,
    };
  }

  async sendStickerMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    this.ensureReady();
    let messageMedia: MessageMedia;

    if (typeof media.data === 'string') {
      if (media.data.startsWith('http://') || media.data.startsWith('https://')) {
        messageMedia = await MessageMedia.fromUrl(media.data);
      } else {
        messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
      }
    } else {
      messageMedia = new MessageMedia(media.mimetype, media.data.toString('base64'), media.filename);
    }

    const msg = await this.client!.sendMessage(chatId, messageMedia, {
      sendMediaAsSticker: true,
    });
    return {
      id: msg.id._serialized,
      timestamp: msg.timestamp,
    };
  }

  async replyToMessage(chatId: string, quotedMsgId: string, text: string): Promise<MessageResult> {
    this.ensureReady();
    // Find the message to quote
    const chat = await this.client!.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    const quotedMsg = messages.find(m => m.id._serialized === quotedMsgId);

    if (!quotedMsg) {
      throw new Error(`Message ${quotedMsgId} not found`);
    }

    const msg = await this.withBrowserSend(() => quotedMsg.reply(text));
    return {
      id: msg.id._serialized,
      timestamp: msg.timestamp,
    };
  }

  async forwardMessage(fromChatId: string, toChatId: string, messageId: string): Promise<MessageResult> {
    this.ensureReady();
    const chat = await this.client!.getChatById(fromChatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    const msgToForward = messages.find(m => m.id._serialized === messageId);

    if (!msgToForward) {
      throw new Error(`Message ${messageId} not found`);
    }

    await msgToForward.forward(toChatId);
    // forward() returns void, so we generate a result based on original message
    return {
      id: `fwd_${messageId}`,
      timestamp: Date.now(),
    };
  }

  // ============= Phase 3: Group Management =============

  async getGroupInfo(groupId: string): Promise<GroupInfo | null> {
    this.ensureReady();
    try {
      const chat = await this.client!.getChatById(groupId);
      if (!chat.isGroup) {
        return null;
      }
      const groupChat = chat as unknown as GroupChat;
      const participants: GroupParticipant[] = (groupChat.participants || []).map(p => ({
        id: String(p.id._serialized),
        number: String(p.id.user),
        name: p.name ? String(p.name) : undefined,
        isAdmin: Boolean(p.isAdmin),
        isSuperAdmin: Boolean(p.isSuperAdmin),
      }));

      return {
        id: chat.id._serialized,
        name: chat.name,
        description: groupChat.description ? String(groupChat.description) : undefined,
        owner: groupChat.owner?._serialized ? String(groupChat.owner._serialized) : undefined,
        createdAt: groupChat.createdAt,
        participants,
        isReadOnly: Boolean(groupChat.isReadOnly),
        isAnnounce: Boolean(groupChat.isAnnounce),
      };
    } catch (error) {
      this.logger.warn(`Failed to get group: ${groupId}`, String(error));
      return null;
    }
  }

  async createGroup(name: string, participants: string[]): Promise<Group> {
    this.ensureReady();
    // Ensure participant IDs are in correct format
    const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
    const result = await this.client!.createGroup(name, participantIds);

    const groupId = String((result as unknown as GroupCreateResult).gid._serialized);
    return {
      id: groupId,
      name: name,
      participantsCount: participants.length,
    };
  }

  async addParticipants(groupId: string, participants: string[]): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error('Chat is not a group');
    }
    const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
    await (chat as unknown as GroupChat).addParticipants(participantIds);
  }

  async removeParticipants(groupId: string, participants: string[]): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error('Chat is not a group');
    }
    const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
    await (chat as unknown as GroupChat).removeParticipants(participantIds);
  }

  async promoteParticipants(groupId: string, participants: string[]): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error('Chat is not a group');
    }
    const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
    await (chat as unknown as GroupChat).promoteParticipants(participantIds);
  }

  async demoteParticipants(groupId: string, participants: string[]): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error('Chat is not a group');
    }
    const participantIds = participants.map(p => (p.includes('@') ? p : `${p}@c.us`));
    await (chat as unknown as GroupChat).demoteParticipants(participantIds);
  }

  async leaveGroup(groupId: string): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error('Chat is not a group');
    }
    await (chat as unknown as GroupChat).leave();
  }

  async setGroupSubject(groupId: string, subject: string): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error('Chat is not a group');
    }
    await (chat as unknown as GroupChat).setSubject(subject);
  }

  async setGroupDescription(groupId: string, description: string): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error('Chat is not a group');
    }
    await (chat as unknown as GroupChat).setDescription(description);
  }

  // Reactions (Phase 3)
  async reactToMessage(chatId: string, messageId: string, emoji: string): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    const message = messages.find(m => m.id._serialized === messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found in chat ${chatId}`);
    }
    await (message as MessageWithReactions).react(emoji);
    this.logger.log(`Reacted to message ${messageId} with ${emoji || '(removed)'}`);
  }

  async getMessageReactions(chatId: string, messageId: string): Promise<MessageReaction[]> {
    this.ensureReady();
    const chat = await this.client!.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    const message = messages.find(m => m.id._serialized === messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found in chat ${chatId}`);
    }
    const msgWithReactions = message as MessageWithReactions;
    if (!msgWithReactions.hasReaction) {
      return [];
    }
    const reactions = await msgWithReactions.getReactions();
    if (!reactions) {
      return [];
    }
    // Map reactions to our interface format
    const result: MessageReaction[] = [];

    for (const r of reactions) {
      result.push({
        emoji: String(r.id),
        senders: (r.senders || []).map(s => ({
          senderId: String(s.senderId),
          emoji: String(s.reaction),
          timestamp: Number(s.timestamp),
        })),
      });
    }
    return result;
  }

  // Labels (Phase 3) - WhatsApp Business only
  async getLabels(): Promise<Label[]> {
    this.ensureReady();
    const labels = await (this.client as unknown as BusinessClient).getLabels();
    if (!labels) {
      return [];
    }

    return labels.map(label => ({
      id: String(label.id),
      name: String(label.name),
      hexColor: String(label.hexColor),
    }));
  }

  async getLabelById(labelId: string): Promise<Label | null> {
    this.ensureReady();
    const label = await (this.client as unknown as BusinessClient).getLabelById(labelId);
    if (!label) {
      return null;
    }
    return {
      id: String(label.id),
      name: String(label.name),
      hexColor: String(label.hexColor),
    };
  }

  async getChatLabels(chatId: string): Promise<Label[]> {
    this.ensureReady();
    const chat = await this.client!.getChatById(chatId);
    const labels = await (chat as unknown as GroupChat).getLabels();
    if (!labels) {
      return [];
    }

    return labels.map(label => ({
      id: String(label.id),
      name: String(label.name),
      hexColor: String(label.hexColor),
    }));
  }

  async addLabelToChat(chatId: string, labelId: string): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(chatId);
    await (chat as unknown as GroupChat).addLabel(labelId);
    this.logger.log(`Added label ${labelId} to chat ${chatId}`);
  }

  async removeLabelFromChat(chatId: string, labelId: string): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(chatId);
    await (chat as unknown as GroupChat).removeLabel(labelId);
    this.logger.log(`Removed label ${labelId} from chat ${chatId}`);
  }

  // Channels/Newsletter (Phase 3)
  async getSubscribedChannels(): Promise<Channel[]> {
    this.ensureReady();
    const channels = await (this.client as unknown as BusinessClient).getChannels();
    if (!channels) {
      return [];
    }
    return channels.map((ch: WwjsChannelData) => ({
      id: String(typeof ch.id === 'object' ? ch.id._serialized : ch.id),
      name: String(ch.name || ''),
      description: ch.description ? String(ch.description) : undefined,
      inviteCode: ch.inviteCode ? String(ch.inviteCode) : undefined,
      subscriberCount: ch.subscriberCount ? Number(ch.subscriberCount) : undefined,
      verified: ch.verified ? Boolean(ch.verified) : undefined,
    }));
  }

  async getChannelById(channelId: string): Promise<Channel | null> {
    this.ensureReady();
    try {
      const ch = await (this.client as unknown as BusinessClient).getChannelById(channelId);
      if (!ch) {
        return null;
      }
      return {
        id: String(typeof ch.id === 'object' ? ch.id._serialized : ch.id),
        name: String(ch.name || ''),
        description: ch.description ? String(ch.description) : undefined,
        inviteCode: ch.inviteCode ? String(ch.inviteCode) : undefined,
        subscriberCount: ch.subscriberCount ? Number(ch.subscriberCount) : undefined,
        verified: ch.verified ? Boolean(ch.verified) : undefined,
      };
    } catch (error) {
      this.logger.warn(`Failed to get channel: ${channelId}`, String(error));
      return null;
    }
  }

  async subscribeToChannel(inviteCode: string): Promise<Channel> {
    this.ensureReady();
    const ch = await (this.client as unknown as BusinessClient).subscribeToChannel(inviteCode);
    this.logger.log(`Subscribed to channel with invite code: ${inviteCode}`);
    return {
      id: String(typeof ch.id === 'object' ? ch.id._serialized : ch.id),
      name: String(ch.name || ''),
      description: ch.description ? String(ch.description) : undefined,
    };
  }

  async unsubscribeFromChannel(channelId: string): Promise<void> {
    this.ensureReady();
    await (this.client as unknown as BusinessClient).unsubscribeFromChannel(channelId);
    this.logger.log(`Unsubscribed from channel: ${channelId}`);
  }

  async getChannelMessages(channelId: string, limit: number = 50): Promise<ChannelMessage[]> {
    this.ensureReady();
    try {
      const ch = await (this.client as unknown as BusinessClient).getChannelById(channelId);
      if (!ch) {
        throw new Error(`Channel ${channelId} not found`);
      }
      const messages = await ch.fetchMessages({ limit });
      if (!messages) {
        return [];
      }
      return messages.map(msg => ({
        id: String(typeof msg.id === 'object' ? msg.id._serialized : msg.id),
        body: String(msg.body || ''),
        timestamp: Number(msg.timestamp),
        hasMedia: Boolean(msg.hasMedia),
        mediaUrl: msg.mediaUrl ? String(msg.mediaUrl) : undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to get channel messages: ${String(error)}`);
      return [];
    }
  }

  // ========== Gap Quick Wins Implementation ==========

  // Delete Message
  async deleteMessage(chatId: string, messageId: string, forEveryone: boolean = true): Promise<void> {
    this.ensureReady();
    const chat = await this.client!.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    const message = messages.find(m => m.id._serialized === messageId || m.id.id === messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found in chat ${chatId}`);
    }
    await message.delete(forEveryone);
    this.logger.log(`Deleted message ${messageId} from chat ${chatId} (forEveryone: ${forEveryone})`);
  }

  // Get Profile Picture
  async getProfilePicture(contactId: string): Promise<string | null> {
    if (
      (this.status !== EngineStatus.READY && this.status !== EngineStatus.LOADING_CHATS) ||
      !this.client
    ) {
      return null;
    }
    const candidates = await this.buildProfilePictureCandidates(contactId);

    for (const id of candidates) {
      try {
        const url = await this.client!.getProfilePicUrl(id);
        if (url) return url;
      } catch (error) {
        this.logger.debug(`Profile picture unavailable for ${id}: ${String(error)}`);
      }
    }

    return null;
  }

  async downloadProfilePicture(
    contactId: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (
      (this.status !== EngineStatus.READY && this.status !== EngineStatus.LOADING_CHATS) ||
      !this.client?.pupPage
    ) {
      return null;
    }
    const candidates = await this.buildProfilePictureCandidates(contactId);
    const page = this.client.pupPage;

    for (const id of candidates) {
      try {
        const result = await page.evaluate(async (chatId: string) => {
          try {
            const wweb = (window as unknown as { WWebJS?: { getChat: (id: string) => Promise<unknown> } })
              .WWebJS;
            if (!wweb) return null;
            const chat = await wweb.getChat(chatId);
            const profilePic = await (window as unknown as { require: (name: string) => any })
              .require('WAWebContactProfilePicThumbBridge')
              .requestProfilePicFromServer(chat);
            const url = profilePic?.eurl as string | undefined;
            if (!url) return null;
            const response = await fetch(url);
            if (!response.ok) return null;
            const blob = await response.blob();
            if (!blob.size) return null;
            const arrayBuffer = await blob.arrayBuffer();
            return {
              bytes: Array.from(new Uint8Array(arrayBuffer)),
              contentType: blob.type || 'image/jpeg',
            };
          } catch {
            return null;
          }
        }, id);

        if (result?.bytes?.length) {
          return {
            buffer: Buffer.from(result.bytes),
            contentType: result.contentType || 'image/jpeg',
          };
        }
      } catch (error) {
        this.logger.debug(`Profile picture download unavailable for ${id}: ${String(error)}`);
      }
    }

    return null;
  }

  private async buildProfilePictureCandidates(contactId: string): Promise<string[]> {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const add = (id?: string | null) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      candidates.push(id);
    };

    add(contactId);

    try {
      const contact = await this.client!.getContactById(contactId);
      add(contact.id._serialized);
      if (contact.number) {
        const digits = contact.number.replace(/\D/g, '');
        if (digits) add(`${digits}@c.us`);
      }
    } catch {
      // Chat/contact may not exist in WA store yet
    }

    if (contactId.endsWith('@g.us') || contactId.endsWith('@lid')) {
      try {
        const chat = await this.client!.getChatById(contactId);
        add(chat.id._serialized);
        if (contactId.endsWith('@lid')) {
          const chatContact = await chat.getContact();
          add(chatContact.id._serialized);
          if (chatContact.number) {
            const digits = chatContact.number.replace(/\D/g, '');
            if (digits) add(`${digits}@c.us`);
          }
        }
      } catch {
        // ignore
      }
    }

    return candidates;
  }

  // Block Contact
  async blockContact(contactId: string): Promise<void> {
    this.ensureReady();
    const contact = await this.client!.getContactById(contactId);
    await contact.block();
    this.logger.log(`Blocked contact ${contactId}`);
  }

  // Unblock Contact
  async unblockContact(contactId: string): Promise<void> {
    this.ensureReady();
    const contact = await this.client!.getContactById(contactId);
    await contact.unblock();
    this.logger.log(`Unblocked contact ${contactId}`);
  }

  // Get Group Invite Code
  async getGroupInviteCode(groupId: string): Promise<string> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error(`${groupId} is not a group`);
    }
    const inviteCode = await (chat as unknown as GroupChat).getInviteCode();
    this.logger.log(`Got invite code for group ${groupId}`);
    return String(inviteCode);
  }

  // Revoke Group Invite Code
  async revokeGroupInviteCode(groupId: string): Promise<string> {
    this.ensureReady();
    const chat = await this.client!.getChatById(groupId);
    if (!chat.isGroup) {
      throw new Error(`${groupId} is not a group`);
    }
    const newCode = await (chat as unknown as GroupChat).revokeInvite();
    this.logger.log(`Revoked invite code for group ${groupId}, new code generated`);
    return String(newCode);
  }

  // ========== Status/Stories (Phase 3) ==========
  // Note: These are stub implementations - whatsapp-web.js has limited Status API support
  /* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */

  async getContactStatuses(): Promise<Status[]> {
    this.ensureReady();
    // whatsapp-web.js has limited Status API support
    // This is a stub that can be enhanced when the library adds support
    this.logger.warn('getContactStatuses not fully implemented in whatsapp-web.js');
    return [];
  }

  async getContactStatus(_contactId: string): Promise<Status[]> {
    this.ensureReady();
    this.logger.warn('getContactStatus not fully implemented in whatsapp-web.js');
    return [];
  }

  async postTextStatus(_text: string, _options?: TextStatusOptions): Promise<StatusResult> {
    this.ensureReady();
    // whatsapp-web.js doesn't have native status posting
    // This would require using the underlying WhatsApp Web API directly
    throw new Error('postTextStatus not yet implemented in whatsapp-web.js adapter');
  }

  async postImageStatus(_media: MediaInput, _caption?: string): Promise<StatusResult> {
    this.ensureReady();
    throw new Error('postImageStatus not yet implemented in whatsapp-web.js adapter');
  }

  async postVideoStatus(_media: MediaInput, _caption?: string): Promise<StatusResult> {
    this.ensureReady();
    throw new Error('postVideoStatus not yet implemented in whatsapp-web.js adapter');
  }

  async deleteStatus(_statusId: string): Promise<void> {
    this.ensureReady();
    throw new Error('deleteStatus not yet implemented in whatsapp-web.js adapter');
  }

  // ========== Catalog (Phase 3) ==========

  async getCatalog(): Promise<Catalog | null> {
    this.ensureReady();
    // whatsapp-web.js doesn't have native Catalog API support
    this.logger.warn('getCatalog not implemented in whatsapp-web.js adapter');
    return null;
  }

  async getProducts(_options?: ProductQueryOptions): Promise<PaginatedProducts> {
    this.ensureReady();
    this.logger.warn('getProducts not implemented in whatsapp-web.js adapter');
    return {
      products: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  async getProduct(_productId: string): Promise<Product | null> {
    this.ensureReady();
    this.logger.warn('getProduct not implemented in whatsapp-web.js adapter');
    return null;
  }

  async sendProduct(_chatId: string, _productId: string, _body?: string): Promise<MessageResult> {
    this.ensureReady();
    throw new Error('sendProduct not yet implemented in whatsapp-web.js adapter');
  }

  async sendCatalog(_chatId: string, _body?: string): Promise<MessageResult> {
    this.ensureReady();
    throw new Error('sendCatalog not yet implemented in whatsapp-web.js adapter');
  }

  /* eslint-enable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */

  private ensureReady(): void {
    const operational =
      this.status === EngineStatus.READY || this.status === EngineStatus.LOADING_CHATS;
    if (!operational || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }
  }

  private async withBrowserSend<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (isWhatsAppBrowserDetachedError(error)) {
        this.logger.warn('WhatsApp browser detached — marking session disconnected');
        this.client = null;
        this.setStatus(EngineStatus.DISCONNECTED);
      }
      throw error;
    }
  }
}
