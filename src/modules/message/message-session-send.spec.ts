import { BadRequestException } from '@nestjs/common';
import { MessageService } from './message.service';
import { SessionStatus } from '../session/entities/session.entity';

const configServiceMock = { get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue) };

describe('MessageService session-specific sending', () => {
  it('rejects send when session is not ready', async () => {
    const sessionService = {
      findOne: jest.fn().mockResolvedValue({ id: 'sess-a', status: SessionStatus.DISCONNECTED }),
      getEngine: jest.fn(),
    };

    const service = new MessageService(
      {} as never,
      {} as never,
      sessionService as never,
      {
        execute: jest.fn().mockResolvedValue({
          continue: true,
          data: { input: { chatId: '1234567890@c.us', text: 'hi' } },
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      configServiceMock as never,
    );

    await expect(
      service.sendText('sess-a', { chatId: '1234567890@c.us', text: 'hi' }),
    ).rejects.toThrow(BadRequestException);
    expect(sessionService.getEngine).not.toHaveBeenCalled();
  });

  it('sendTextFromInbox returns SESSION_NOT_READY without calling engine', async () => {
    const sessionService = {
      findOne: jest.fn().mockResolvedValue({ id: 'sess-a', status: SessionStatus.QR_READY }),
      getEngine: jest.fn(),
    };

    const service = new MessageService(
      { exist: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      sessionService as never,
      {
        execute: jest.fn().mockResolvedValue({
          continue: true,
          data: { input: { chatId: '1234567890@c.us', text: 'hi' } },
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { findAll: jest.fn() } as never,
      {} as never,
      configServiceMock as never,
    );

    const result = await service.sendTextFromInbox(
      { id: 'staff-1', allowedSessions: null } as never,
      'sess-a',
      '1234567890@c.us',
      'hi',
    );
    expect(result).toMatchObject({ ok: false, code: 'SESSION_NOT_READY' });
    expect(sessionService.getEngine).not.toHaveBeenCalled();
  });

  it('sendImageFromInbox returns SESSION_NOT_READY without calling sendImage', async () => {
    const sessionService = {
      findOne: jest.fn().mockResolvedValue({ id: 'sess-a', status: SessionStatus.DISCONNECTED }),
      getEngine: jest.fn(),
    };

    const sendImage = jest.fn();
    const service = new MessageService(
      { exist: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      sessionService as never,
      {
        execute: jest.fn().mockResolvedValue({ continue: true, data: {} }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { findAll: jest.fn() } as never,
      {} as never,
      configServiceMock as never,
    );
    (service as { sendImage: typeof sendImage }).sendImage = sendImage;

    const result = await service.sendImageFromInbox(
      { id: 'staff-1', allowedSessions: null } as never,
      'sess-a',
      { chatId: '1234567890@c.us', base64: 'abc', mimetype: 'image/jpeg' },
    );

    expect(result).toMatchObject({ ok: false, code: 'SESSION_NOT_READY' });
    expect(sendImage).not.toHaveBeenCalled();
  });

  it('sendDocumentFromInbox returns SESSION_NOT_READY without calling sendDocument', async () => {
    const sessionService = {
      findOne: jest.fn().mockResolvedValue({ id: 'sess-a', status: SessionStatus.DISCONNECTED }),
      getEngine: jest.fn(),
    };

    const sendDocument = jest.fn();
    const service = new MessageService(
      { exist: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      sessionService as never,
      {
        execute: jest.fn().mockResolvedValue({ continue: true, data: {} }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { findAll: jest.fn() } as never,
      {} as never,
      configServiceMock as never,
    );
    (service as { sendDocument: typeof sendDocument }).sendDocument = sendDocument;

    const result = await service.sendDocumentFromInbox(
      { id: 'staff-1', allowedSessions: null } as never,
      'sess-a',
      { chatId: '1234567890@c.us', base64: 'abc', mimetype: 'application/pdf' },
    );

    expect(result).toMatchObject({ ok: false, code: 'SESSION_NOT_READY' });
    expect(sendDocument).not.toHaveBeenCalled();
  });
});
