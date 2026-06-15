import * as path from 'path';
import * as fs from 'fs';
import * as qrcode from 'qrcode';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import makeWASocket, {
  type WASocket,
  type WAMessage,
  type Chat,
  downloadMediaMessage,
  extractMessageContent,
  getContentType,
  UNAUTHORIZED_CODES,
  useMultiFileAuthState,
  USyncQuery,
  USyncUser,
  type PresenceData,
} from '@whiskeysockets/baileys';
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
  ChatSummary,
} from '../interfaces/whatsapp-engine.interface';
import { createLogger } from '../../common/services/logger.service';
import {
  isInboxChat,
  normalizeMessageType,
  defaultMimetypeForMessageType,
} from '../../common/utils/inbox-chat.util';
import {
  isPlausiblePhoneDigits,
  isUsableWhatsAppChatTitle,
} from '../../common/utils/inbox-display.util';
import { toBaileysJid, toOpenWaChatId, phoneFromJid, phoneDigitsFromOpenWaChatId } from './baileys-jid.util';
import { buildBaileysProxyAgent } from './baileys-proxy.util';
import { mapBaileysContactPresence } from './baileys-presence.util';
import { applyBaileysMediaToIncoming, readBaileysMediaDetails } from './baileys-message-media.util';

export interface BaileysAdapterConfig {
  sessionId: string;
  sessionDataPath: string;
  proxy?: {
    url: string;
    type: 'http' | 'https' | 'socks4' | 'socks5';
  };
}

export class BaileysAdapter implements IWhatsAppEngine {
  private sock: WASocket | null = null;
  private status: EngineStatus = EngineStatus.DISCONNECTED;
  private qrCode: string | null = null;
  private phoneNumber: string | null = null;
  private pushName: string | null = null;
  private callbacks: EngineEventCallbacks = {};
  private saveCreds: (() => Promise<void>) | null = null;
  private readonly messageCache = new Map<string, WAMessage>();
  private readonly chatMessages = new Map<string, WAMessage[]>();
  private readonly chatSummaries = new Map<string, ChatSummary>();
  private readonly presenceCache = new Map<string, ContactPresence>();
  private readonly logger = createLogger('BaileysAdapter');

  constructor(private readonly config: BaileysAdapterConfig) {}

  async initialize(callbacks: EngineEventCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.setStatus(EngineStatus.INITIALIZING);

    const authDir = path.join(path.resolve(this.config.sessionDataPath), 'baileys', this.config.sessionId);
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    this.saveCreds = saveCreds;

    const agent = buildBaileysProxyAgent(this.config.proxy);
    const silentLogger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
      agent,
      fetchAgent: agent,
      getMessage: async key => {
        const id = key.id ?? '';
        return this.messageCache.get(id)?.message ?? undefined;
      },
    });

    this.sock.ev.on('creds.update', () => {
      void this.saveCreds?.();
    });

    this.sock.ev.on('connection.update', update => {
      void this.handleConnectionUpdate(update);
    });

    this.sock.ev.on('messages.upsert', ({ messages, type }) => {
      for (const msg of messages) {
        this.cacheMessage(msg);
        if (type === 'notify') void this.handleIncomingMessage(msg);
      }
    });

    this.sock.ev.on('messaging-history.set', ({ messages }) => {
      for (const msg of messages) this.cacheMessage(msg);
    });

    this.sock.ev.on('chats.upsert', chats => {
      for (const chat of chats) this.cacheChat(chat);
    });

    this.sock.ev.on('chats.update', updates => {
      for (const update of updates) {
        if (!update.id) continue;
        const chatId = toOpenWaChatId(update.id);
        const prev = this.chatSummaries.get(chatId);
        this.cacheChat({
          id: update.id,
          name: update.name ?? prev?.name,
          unreadCount: update.unreadCount ?? prev?.unreadCount,
          lastMessageRecvTimestamp: update.lastMessageRecvTimestamp ?? prev?.lastMessageAt,
        });
      }
    });

    this.sock.ev.on('messages.update', updates => {
      for (const update of updates) {
        if (update.update?.status != null && update.key.id) {
          this.callbacks.onMessageAck?.(update.key.id, update.update.status);
        }
      }
    });

    this.sock.ev.on('presence.update', ({ id, presences }) => {
      for (const [participant, data] of Object.entries(presences)) {
        const chatId = toOpenWaChatId(participant);
        this.presenceCache.set(chatId, mapBaileysContactPresence(chatId, data));
      }
      if (id) {
        const chatId = toOpenWaChatId(id);
        const selfPresence = presences[id];
        if (selfPresence) {
          this.presenceCache.set(chatId, mapBaileysContactPresence(chatId, selfPresence));
        }
      }
    });
  }

  private async handleConnectionUpdate(update: {
    connection?: string;
    lastDisconnect?: { error?: Error };
    qr?: string;
  }): Promise<void> {
    if (update.qr) {
      try {
        this.qrCode = await qrcode.toDataURL(update.qr);
        this.setStatus(EngineStatus.QR_READY);
        this.callbacks.onQRCode?.(this.qrCode);
      } catch (err) {
        this.logger.error('QR generation failed', String(err));
      }
    }

    if (update.connection === 'connecting') {
      if (this.status !== EngineStatus.QR_READY) {
        this.setStatus(EngineStatus.AUTHENTICATING);
      }
    }

    if (update.connection === 'open') {
      this.qrCode = null;
      const user = this.sock?.user;
      this.phoneNumber = user ? phoneFromJid(user.id) : null;
      this.pushName = user?.name ?? user?.verifiedName ?? null;
      this.callbacks.onReady?.(this.phoneNumber ?? '', this.pushName ?? '');
      this.setStatus(EngineStatus.READY);
      void this.prefetchGroupSubjects();
    }

    if (update.connection === 'close') {
      const statusCode = (update.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      if (statusCode && UNAUTHORIZED_CODES.includes(statusCode)) {
        this.setStatus(EngineStatus.FAILED);
        this.callbacks.onAuthFailure?.(`Authentication failed (${statusCode})`);
        return;
      }
      this.setStatus(EngineStatus.DISCONNECTED);
      this.callbacks.onDisconnected?.(String(statusCode ?? 'closed'));
    }
  }

  private cacheChat(chat: Chat): void {
    const chatId = toOpenWaChatId(chat.id ?? '');
    if (!chatId || !isInboxChat(chatId)) return;
    this.chatSummaries.set(chatId, {
      chatId,
      name: chat.name?.trim() || '',
      isGroup: chatId.endsWith('@g.us'),
      unreadCount: chat.unreadCount ?? undefined,
      lastMessageAt: chat.lastMessageRecvTimestamp ?? undefined,
    });
  }

  private cacheMessage(msg: WAMessage): void {
    const id = msg.key.id;
    if (id) this.messageCache.set(id, msg);
    const chatId = toOpenWaChatId(msg.key.remoteJid ?? '');
    if (!chatId) return;
    const list = this.chatMessages.get(chatId) ?? [];
    const idx = list.findIndex(m => m.key.id === id);
    if (idx >= 0) list[idx] = msg;
    else list.push(msg);
    list.sort((a, b) => Number(a.messageTimestamp ?? 0) - Number(b.messageTimestamp ?? 0));
    if (list.length > 500) list.splice(0, list.length - 500);
    this.chatMessages.set(chatId, list);
  }

  private mapWAMessageToIncoming(msg: WAMessage, chatId: string): IncomingMessage {
    const content = msg.message ? extractMessageContent(msg.message) : undefined;
    const rawContentType = getContentType(content ?? undefined);
    const contentType = normalizeMessageType(rawContentType ?? 'chat');
    const body =
      rawContentType === 'conversation'
        ? (content?.conversation ?? '')
        : rawContentType === 'extendedTextMessage'
          ? (content?.extendedTextMessage?.text ?? '')
          : '';
    const id = msg.key.id ?? '';
    const isGroup = chatId.endsWith('@g.us');
    const cached = this.chatSummaries.get(chatId);
    const cachedName = cached?.name?.trim();
    const incoming: IncomingMessage = {
      id,
      from: toOpenWaChatId(msg.key.participant ?? msg.key.remoteJid ?? chatId),
      to: chatId,
      chatId,
      body,
      type: contentType,
      timestamp: Number(msg.messageTimestamp ?? 0),
      fromMe: Boolean(msg.key.fromMe),
      isGroup,
      chatName:
        cachedName && isUsableWhatsAppChatTitle(cachedName, chatId) ? cachedName : undefined,
      author: isGroup ? toOpenWaChatId(msg.key.participant ?? undefined) : undefined,
      notifyName: msg.pushName ?? undefined,
      remoteJidAlt: msg.key.remoteJidAlt ? toOpenWaChatId(msg.key.remoteJidAlt) : undefined,
      participantAlt: msg.key.participantAlt ? toOpenWaChatId(msg.key.participantAlt) : undefined,
      broadcast: Boolean(msg.broadcast),
    };
    applyBaileysMediaToIncoming(incoming, msg);
    return incoming;
  }

  private phoneFromCachedMessages(chatId: string): string {
    const messages = this.chatMessages.get(chatId) ?? [];
    for (const msg of [...messages].reverse()) {
      for (const alt of [msg.key.remoteJidAlt, msg.key.participantAlt]) {
        if (!alt) continue;
        const digits = phoneDigitsFromOpenWaChatId(toOpenWaChatId(alt));
        if (digits) return digits;
      }
    }
    return '';
  }

  private pushNameFromCachedMessages(chatId: string): string | undefined {
    const messages = this.chatMessages.get(chatId) ?? [];
    for (const msg of [...messages].reverse()) {
      const name = msg.pushName?.trim();
      if (name && isUsableWhatsAppChatTitle(name, chatId)) return name;
    }
    return undefined;
  }

  private async resolveLidPhoneDigits(openWaLid: string): Promise<string> {
    const sock = this.sock;
    if (!sock) return '';

    const baileysLid = toBaileysJid(openWaLid);

    const mapped = await sock.signalRepository.lidMapping.getPNForLID(baileysLid);
    if (mapped) {
      const digits = phoneFromJid(mapped).replace(/\D/g, '');
      if (isPlausiblePhoneDigits(digits)) return digits;
    }

    const fromCache = this.phoneFromCachedMessages(openWaLid);
    if (fromCache) return fromCache;

    try {
      const query = new USyncQuery()
        .withContext('interactive')
        .withDeviceProtocol()
        .withLIDProtocol();
      query.withUser(new USyncUser().withId(baileysLid));
      const result = await sock.executeUSyncQuery(query);
      const rows = result?.list ?? [];
      const lidRows = rows.filter(row => typeof row.lid === 'string' && row.lid.length > 0);
      if (lidRows.length > 0) {
        await sock.signalRepository.lidMapping.storeLIDPNMappings(
          lidRows.map(row => ({ lid: row.lid as string, pn: row.id })),
        );
      }
      const remapped = await sock.signalRepository.lidMapping.getPNForLID(baileysLid);
      if (remapped) {
        const digits = phoneFromJid(remapped).replace(/\D/g, '');
        if (isPlausiblePhoneDigits(digits)) return digits;
      }
      for (const row of rows) {
        const digits = phoneDigitsFromOpenWaChatId(row.id);
        if (digits) return digits;
      }
    } catch (error) {
      this.logger.warn(`USync LID phone resolve failed for ${openWaLid}`, String(error));
    }

    try {
      const reverseQuery = new USyncQuery().withContext('background').withLIDProtocol();
      reverseQuery.withUser(new USyncUser().withLid(baileysLid));
      const reverse = await sock.executeUSyncQuery(reverseQuery);
      for (const row of reverse?.list ?? []) {
        const digits = phoneDigitsFromOpenWaChatId(row.id);
        if (digits) return digits;
      }
    } catch (error) {
      this.logger.warn(`USync reverse LID resolve failed for ${openWaLid}`, String(error));
    }

    return '';
  }

  private async prefetchGroupSubjects(): Promise<void> {
    const sock = this.sock;
    if (!sock) return;
    try {
      const groups = await sock.groupFetchAllParticipating();
      for (const g of Object.values(groups)) {
        this.cacheChat({ id: g.id, name: g.subject } as Chat);
      }
    } catch (error) {
      this.logger.warn('Group subject prefetch failed', String(error));
    }
  }

  private async handleIncomingMessage(msg: WAMessage): Promise<void> {
    if (!msg.message || msg.key.fromMe) return;

    const chatId = toOpenWaChatId(msg.key.remoteJid ?? '');
    if (!isInboxChat(chatId)) return;

    const incoming = this.mapWAMessageToIncoming(msg, chatId);
    this.callbacks.onMessage?.(incoming);
  }

  private findCachedWAMessage(waMessageId: string): WAMessage | undefined {
    const cached = this.messageCache.get(waMessageId);
    if (cached) return cached;
    for (const list of this.chatMessages.values()) {
      const match = list.find(m => m.key.id === waMessageId);
      if (match) return match;
    }
    return undefined;
  }

  private setStatus(status: EngineStatus): void {
    this.status = status;
    this.callbacks.onStateChanged?.(status);
  }

  private ensureReady(): WASocket {
    if (!this.sock || this.status !== EngineStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }
    return this.sock;
  }

  private notImplemented(feature: string): never {
    throw new Error(`${feature} is not implemented in the Baileys engine yet`);
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
      this.setStatus(EngineStatus.DISCONNECTED);
    }
  }

  async logout(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        this.logger.warn('Baileys logout failed', String(err));
      }
      this.sock = null;
      this.setStatus(EngineStatus.DISCONNECTED);
    }
  }

  async destroy(): Promise<void> {
    await this.disconnect();
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
    const sock = this.ensureReady();
    const jid = toBaileysJid(chatId);
    const sent = await sock.sendMessage(jid, { text });
    const id = sent?.key.id ?? '';
    if (id && sent) this.messageCache.set(id, sent);
    return { id, timestamp: Number(sent?.messageTimestamp ?? Date.now()) };
  }

  private async sendMediaMessage(chatId: string, media: MediaInput, kind: 'image' | 'video' | 'audio' | 'document'): Promise<MessageResult> {
    const sock = this.ensureReady();
    const jid = toBaileysJid(chatId);
    const buffer = typeof media.data === 'string' ? Buffer.from(media.data, 'base64') : media.data;
    const payload =
      kind === 'image'
        ? { image: buffer, caption: media.caption, mimetype: media.mimetype }
        : kind === 'video'
          ? { video: buffer, caption: media.caption, mimetype: media.mimetype }
          : kind === 'audio'
            ? { audio: buffer, mimetype: media.mimetype, ptt: media.mimetype.includes('ogg') }
            : { document: buffer, mimetype: media.mimetype, fileName: media.filename, caption: media.caption };

    const quoted = media.quotedMessageId?.trim()
      ? this.messageCache.get(media.quotedMessageId.trim())
      : undefined;

    const sent = await sock.sendMessage(jid, payload, quoted ? { quoted } : undefined);
    const id = sent?.key.id ?? '';
    if (id && sent) this.messageCache.set(id, sent);
    return { id, timestamp: Number(sent?.messageTimestamp ?? Date.now()) };
  }

  async sendImageMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media, 'image');
  }

  async sendImageAlbum(chatId: string, imageUrls: string[], caption?: string): Promise<MessageResult[]> {
    const results: MessageResult[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const res = await fetch(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const isLast = i === imageUrls.length - 1;
      results.push(
        await this.sendMediaMessage(
          chatId,
          { mimetype: 'image/jpeg', data: buffer, caption: isLast ? caption : undefined },
          'image',
        ),
      );
    }
    return results;
  }

  async sendVideoMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media, 'video');
  }

  async sendAudioMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media, 'audio');
  }

  async sendDocumentMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    return this.sendMediaMessage(chatId, media, 'document');
  }

  async sendLocationMessage(chatId: string, location: LocationInput): Promise<MessageResult> {
    const sock = this.ensureReady();
    const sent = await sock.sendMessage(toBaileysJid(chatId), {
      location: {
        degreesLatitude: location.latitude,
        degreesLongitude: location.longitude,
        name: location.description,
        address: location.address,
      },
    });
    return { id: sent?.key.id ?? '', timestamp: Date.now() };
  }

  async sendContactMessage(chatId: string, contact: ContactCard): Promise<MessageResult> {
    const sock = this.ensureReady();
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL;type=CELL;type=VOICE;waid=${contact.number}:${contact.number}\nEND:VCARD`;
    const sent = await sock.sendMessage(toBaileysJid(chatId), {
      contacts: { displayName: contact.name, contacts: [{ vcard }] },
    });
    return { id: sent?.key.id ?? '', timestamp: Date.now() };
  }

  async sendStickerMessage(chatId: string, media: MediaInput): Promise<MessageResult> {
    const sock = this.ensureReady();
    const buffer = typeof media.data === 'string' ? Buffer.from(media.data, 'base64') : media.data;
    const sent = await sock.sendMessage(toBaileysJid(chatId), {
      sticker: buffer,
      mimetype: media.mimetype,
    });
    return { id: sent?.key.id ?? '', timestamp: Date.now() };
  }

  async replyToMessage(chatId: string, quotedMsgId: string, text: string): Promise<MessageResult> {
    const sock = this.ensureReady();
    const quoted = this.messageCache.get(quotedMsgId);
    const sent = await sock.sendMessage(toBaileysJid(chatId), { text }, quoted ? { quoted: quoted } : undefined);
    return { id: sent?.key.id ?? '', timestamp: Date.now() };
  }

  async forwardMessage(fromChatId: string, toChatId: string, messageId: string): Promise<MessageResult> {
    const sock = this.ensureReady();
    const msg = this.messageCache.get(messageId);
    if (!msg?.message) return this.notImplemented('forwardMessage');
    const sent = await sock.sendMessage(toBaileysJid(toChatId), { forward: msg });
    return { id: sent?.key.id ?? '', timestamp: Date.now() };
  }

  async reactToMessage(chatId: string, messageId: string, emoji: string): Promise<void> {
    const sock = this.ensureReady();
    const quoted = this.messageCache.get(messageId);
    if (!quoted?.key) return;
    await sock.sendMessage(toBaileysJid(chatId), {
      react: { text: emoji, key: quoted.key },
    });
  }

  async getMessageReactions(_chatId: string, _messageId: string): Promise<MessageReaction[]> {
    return [];
  }

  async getContacts(): Promise<Contact[]> {
    return [];
  }

  async getContactById(contactId: string): Promise<Contact | null> {
    if (!this.sock || this.status !== EngineStatus.READY) return null;

    try {
      const openWaId = toOpenWaChatId(contactId);
      if (!openWaId || !isInboxChat(openWaId) || openWaId.endsWith('@g.us')) return null;

      let digits = '';
      if (openWaId.endsWith('@c.us')) {
        digits = phoneDigitsFromOpenWaChatId(openWaId) ?? '';
      } else if (openWaId.endsWith('@lid')) {
        digits = await this.resolveLidPhoneDigits(openWaId);
      }

      const chatSummary = this.chatSummaries.get(openWaId);
      const rawName = chatSummary?.name?.trim();
      const pushName =
        (rawName && isUsableWhatsAppChatTitle(rawName, openWaId) ? rawName : undefined) ??
        this.pushNameFromCachedMessages(openWaId);

      if (!isPlausiblePhoneDigits(digits) && !pushName) return null;

      return {
        id: openWaId,
        name: pushName,
        pushName,
        number: digits,
        isMyContact: false,
        isBlocked: false,
      };
    } catch (error) {
      this.logger.warn(`Failed to get contact: ${contactId}`, String(error));
      return null;
    }
  }

  private async resolvePresenceSubscribeJid(openWaId: string): Promise<string> {
    if (openWaId.endsWith('@c.us') || openWaId.endsWith('@g.us')) {
      return toBaileysJid(openWaId);
    }
    if (!openWaId.endsWith('@lid')) {
      return toBaileysJid(openWaId);
    }

    const sock = this.sock;
    if (!sock) return toBaileysJid(openWaId);

    const baileysLid = toBaileysJid(openWaId);
    const mapped = await sock.signalRepository.lidMapping.getPNForLID(baileysLid);
    if (mapped) return mapped;

    const digits = await this.resolveLidPhoneDigits(openWaId);
    if (digits) return `${digits}@s.whatsapp.net`;

    return baileysLid;
  }

  private findPresenceData(
    openWaId: string,
    subscribeJid: string,
    eventId: string,
    presences: Record<string, PresenceData>,
  ): PresenceData | null {
    const subscribeOpenWa = toOpenWaChatId(subscribeJid);
    const eventOpenWa = toOpenWaChatId(eventId);
    const relevant =
      eventOpenWa === openWaId ||
      eventOpenWa === subscribeOpenWa ||
      Object.keys(presences).some(key => {
        const keyOpenWa = toOpenWaChatId(key);
        return keyOpenWa === openWaId || keyOpenWa === subscribeOpenWa;
      });
    if (!relevant) return null;

    return (
      presences[subscribeJid] ??
      presences[eventId] ??
      Object.entries(presences).find(([key]) => {
        const keyOpenWa = toOpenWaChatId(key);
        return keyOpenWa === openWaId || keyOpenWa === subscribeOpenWa;
      })?.[1] ??
      null
    );
  }

  async getContactPresence(contactId: string): Promise<ContactPresence> {
    const openWaId = toOpenWaChatId(contactId);
    const cached = this.presenceCache.get(openWaId);
    if (cached) return cached;

    const sock = this.sock;
    if (!sock || this.status !== EngineStatus.READY) {
      return { chatId: openWaId, state: 'unknown' };
    }

    const subscribeJid = await this.resolvePresenceSubscribeJid(openWaId);
    try {
      await sock.presenceSubscribe(subscribeJid);
    } catch (error) {
      this.logger.warn(`Failed to subscribe presence: ${openWaId}`, String(error));
      return { chatId: openWaId, state: 'unknown' };
    }

    const subscribeOpenWa = toOpenWaChatId(subscribeJid);
    const fresh =
      this.presenceCache.get(openWaId) ??
      (subscribeOpenWa !== openWaId ? this.presenceCache.get(subscribeOpenWa) : undefined);
    if (fresh) return { ...fresh, chatId: openWaId };

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        sock.ev.off('presence.update', onUpdate);
        resolve({ chatId: openWaId, state: 'unknown' });
      }, 2500);

      const onUpdate = ({
        id,
        presences,
      }: {
        id: string;
        presences: Record<string, PresenceData>;
      }) => {
        const data = this.findPresenceData(openWaId, subscribeJid, id, presences);
        if (!data) return;
        clearTimeout(timeout);
        sock.ev.off('presence.update', onUpdate);
        const mapped = mapBaileysContactPresence(openWaId, data);
        this.presenceCache.set(openWaId, mapped);
        if (subscribeOpenWa !== openWaId) {
          this.presenceCache.set(subscribeOpenWa, mapped);
        }
        resolve(mapped);
      };

      sock.ev.on('presence.update', onUpdate);
    });
  }

  async checkNumberExists(number: string): Promise<boolean> {
    const sock = this.ensureReady();
    const digits = number.replace(/\D/g, '');
    const result = await sock.onWhatsApp(digits);
    return Boolean(result?.[0]?.exists);
  }

  async listChats(): Promise<ChatSummary[]> {
    const sock = this.ensureReady();
    const groups = await sock.groupFetchAllParticipating();
    for (const g of Object.values(groups)) {
      this.cacheChat({ id: g.id, name: g.subject } as Chat);
    }
    return Array.from(this.chatSummaries.values()).sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
    );
  }

  async fetchChatMessages(chatId: string, limit = 25): Promise<IncomingMessage[]> {
    this.ensureReady();
    const list = this.chatMessages.get(chatId) ?? [];
    return list
      .filter(m => m.message)
      .slice(-limit)
      .map(m => this.mapWAMessageToIncoming(m, chatId));
  }

  async markChatRead(chatId: string): Promise<void> {
    const sock = this.ensureReady();
    const jid = toBaileysJid(chatId);
    const list = this.chatMessages.get(chatId) ?? [];
    const last = [...list].reverse().find(m => m.key.id && !m.key.fromMe);
    if (!last?.key.id) return;
    await sock.chatModify(
      {
        markRead: true,
        lastMessages: [{ key: last.key, messageTimestamp: last.messageTimestamp ?? Date.now() }],
      },
      jid,
    );
  }

  async sendTyping(chatId: string): Promise<void> {
    await this.ensureReady().sendPresenceUpdate('composing', toBaileysJid(chatId));
  }

  async clearTyping(chatId: string): Promise<void> {
    await this.ensureReady().sendPresenceUpdate('paused', toBaileysJid(chatId));
  }

  async downloadMessageMedia(waMessageId: string): Promise<{ mimetype: string; data: Buffer; filename?: string } | null> {
    const sock = this.ensureReady();
    const msg = this.findCachedWAMessage(waMessageId);
    if (!msg) return null;
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
    const details = readBaileysMediaDetails(msg);
    const content = msg.message ? extractMessageContent(msg.message) : undefined;
    const rawType = getContentType(content ?? undefined);
    return {
      mimetype: details?.mimetype ?? defaultMimetypeForMessageType(normalizeMessageType(rawType ?? 'document')),
      data: buffer as Buffer,
      filename: details?.filename,
    };
  }

  async getGroups(): Promise<Group[]> {
    const sock = this.ensureReady();
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups).map(g => ({
      id: toOpenWaChatId(g.id),
      name: g.subject ?? g.id,
      participantsCount: g.participants?.length,
    }));
  }

  async getGroupInfo(groupId: string): Promise<GroupInfo | null> {
    const sock = this.ensureReady();
    try {
      const meta = await sock.groupMetadata(toBaileysJid(groupId));
      const participants: GroupParticipant[] = (meta.participants ?? []).map(p => ({
        id: toOpenWaChatId(p.id),
        number: phoneFromJid(p.id),
        isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
        isSuperAdmin: p.admin === 'superadmin',
      }));
      return {
        id: toOpenWaChatId(meta.id),
        name: meta.subject ?? '',
        description: meta.desc ?? undefined,
        owner: meta.owner ? toOpenWaChatId(meta.owner) : undefined,
        createdAt: meta.creation,
        participants,
        isAnnounce: meta.announce,
        isReadOnly: meta.restrict,
      };
    } catch {
      return null;
    }
  }

  async createGroup(name: string, participants: string[]): Promise<Group> {
    const sock = this.ensureReady();
    const jids = participants.map(p => toBaileysJid(p.includes('@') ? p : `${p.replace(/\D/g, '')}@c.us`));
    const result = await sock.groupCreate(name, jids);
    return { id: toOpenWaChatId(result.id), name: result.subject ?? name };
  }

  async addParticipants(groupId: string, participants: string[]): Promise<void> {
    await this.ensureReady().groupParticipantsUpdate(
      toBaileysJid(groupId),
      participants.map(p => toBaileysJid(p.includes('@') ? p : `${p.replace(/\D/g, '')}@c.us`)),
      'add',
    );
  }

  async removeParticipants(groupId: string, participants: string[]): Promise<void> {
    await this.ensureReady().groupParticipantsUpdate(
      toBaileysJid(groupId),
      participants.map(p => toBaileysJid(p.includes('@') ? p : `${p.replace(/\D/g, '')}@c.us`)),
      'remove',
    );
  }

  async promoteParticipants(groupId: string, participants: string[]): Promise<void> {
    await this.ensureReady().groupParticipantsUpdate(
      toBaileysJid(groupId),
      participants.map(p => toBaileysJid(p)),
      'promote',
    );
  }

  async demoteParticipants(groupId: string, participants: string[]): Promise<void> {
    await this.ensureReady().groupParticipantsUpdate(
      toBaileysJid(groupId),
      participants.map(p => toBaileysJid(p)),
      'demote',
    );
  }

  async leaveGroup(groupId: string): Promise<void> {
    await this.ensureReady().groupLeave(toBaileysJid(groupId));
  }

  async setGroupSubject(groupId: string, subject: string): Promise<void> {
    await this.ensureReady().groupUpdateSubject(toBaileysJid(groupId), subject);
  }

  async setGroupDescription(groupId: string, description: string): Promise<void> {
    await this.ensureReady().groupUpdateDescription(toBaileysJid(groupId), description);
  }

  async getGroupInviteCode(groupId: string): Promise<string> {
    const code = await this.ensureReady().groupInviteCode(toBaileysJid(groupId));
    return code ?? '';
  }

  async revokeGroupInviteCode(groupId: string): Promise<string> {
    const code = await this.ensureReady().groupRevokeInvite(toBaileysJid(groupId));
    return code ?? '';
  }

  async deleteMessage(chatId: string, messageId: string, forEveryone = false): Promise<void> {
    const sock = this.ensureReady();
    const quoted = this.messageCache.get(messageId);
    const key = quoted?.key ?? { remoteJid: toBaileysJid(chatId), id: messageId, fromMe: true };
    await sock.sendMessage(toBaileysJid(chatId), { delete: key });
    if (!forEveryone) return;
  }

  async getProfilePicture(contactId: string): Promise<string | null> {
    try {
      const sock = this.ensureReady();
      const candidates = await this.buildProfilePictureCandidates(contactId);
      for (const id of candidates) {
        try {
          const url = await sock.profilePictureUrl(toBaileysJid(id), 'image');
          if (url) return url;
        } catch {
          // try next candidate jid
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async downloadProfilePicture(
    contactId: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const sock = this.ensureReady();
      const candidates = await this.buildProfilePictureCandidates(contactId);
      for (const id of candidates) {
        try {
          const url = await sock.profilePictureUrl(toBaileysJid(id), 'image');
          if (!url) continue;
          const response = await fetch(url);
          if (!response.ok) continue;
          const buffer = Buffer.from(await response.arrayBuffer());
          if (!buffer.length || buffer.length > 512 * 1024) continue;
          const contentType = response.headers.get('content-type') ?? 'image/jpeg';
          return { buffer, contentType };
        } catch {
          // try next candidate jid
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async buildProfilePictureCandidates(contactId: string): Promise<string[]> {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const add = (id?: string | null) => {
      const normalized = toOpenWaChatId(id ?? '') || id?.trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push(normalized);
    };

    const openWaId = toOpenWaChatId(contactId) || contactId.trim();
    add(openWaId);

    if (openWaId.endsWith('@lid')) {
      const digits = await this.resolveLidPhoneDigits(openWaId);
      if (digits) add(`${digits}@c.us`);

      const contact = await this.getContactById(openWaId);
      if (contact?.number) {
        const fromContact = contact.number.replace(/\D/g, '');
        if (fromContact) add(`${fromContact}@c.us`);
      }
    } else if (openWaId.endsWith('@c.us')) {
      add(openWaId);
    }

    return candidates;
  }

  async blockContact(contactId: string): Promise<void> {
    await this.ensureReady().updateBlockStatus(toBaileysJid(contactId), 'block');
  }

  async unblockContact(contactId: string): Promise<void> {
    await this.ensureReady().updateBlockStatus(toBaileysJid(contactId), 'unblock');
  }

  async getLabels(): Promise<Label[]> {
    return [];
  }

  async getLabelById(_labelId: string): Promise<Label | null> {
    return null;
  }

  async getChatLabels(_chatId: string): Promise<Label[]> {
    return [];
  }

  async addLabelToChat(_chatId: string, _labelId: string): Promise<void> {
    this.notImplemented('addLabelToChat');
  }

  async removeLabelFromChat(_chatId: string, _labelId: string): Promise<void> {
    this.notImplemented('removeLabelFromChat');
  }

  async getSubscribedChannels(): Promise<Channel[]> {
    return [];
  }

  async getChannelById(_channelId: string): Promise<Channel | null> {
    return null;
  }

  async subscribeToChannel(_inviteCode: string): Promise<Channel> {
    return this.notImplemented('subscribeToChannel');
  }

  async unsubscribeFromChannel(_channelId: string): Promise<void> {
    this.notImplemented('unsubscribeFromChannel');
  }

  async getChannelMessages(_channelId: string, _limit?: number): Promise<ChannelMessage[]> {
    return [];
  }

  async getContactStatuses(): Promise<Status[]> {
    return [];
  }

  async getContactStatus(_contactId: string): Promise<Status[]> {
    return [];
  }

  async postTextStatus(_text: string, _options?: TextStatusOptions): Promise<StatusResult> {
    return this.notImplemented('postTextStatus');
  }

  async postImageStatus(_media: MediaInput, _caption?: string): Promise<StatusResult> {
    return this.notImplemented('postImageStatus');
  }

  async postVideoStatus(_media: MediaInput, _caption?: string): Promise<StatusResult> {
    return this.notImplemented('postVideoStatus');
  }

  async deleteStatus(_statusId: string): Promise<void> {
    this.notImplemented('deleteStatus');
  }

  async getCatalog(): Promise<Catalog | null> {
    return null;
  }

  async getProducts(_options?: ProductQueryOptions): Promise<PaginatedProducts> {
    return { products: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 0 } };
  }

  async getProduct(_productId: string): Promise<Product | null> {
    return null;
  }

  async sendProduct(_chatId: string, _productId: string, _body?: string): Promise<MessageResult> {
    return this.notImplemented('sendProduct');
  }

  async sendCatalog(_chatId: string, _body?: string): Promise<MessageResult> {
    return this.notImplemented('sendCatalog');
  }
}
