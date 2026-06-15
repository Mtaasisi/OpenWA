import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionRelinkReason } from '../../../common/utils/engine-auth.util';
import { SessionStatus } from '../entities/session.entity';

export class SessionResponseDto {
  @ApiProperty({ example: 'sess_123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'my-bot' })
  name: string;

  @ApiProperty({ enum: SessionStatus, example: SessionStatus.READY })
  status: SessionStatus;

  @ApiPropertyOptional({ example: '628123456789' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'John Doe' })
  pushName?: string | null;

  @ApiPropertyOptional({ example: '2025-02-02T10:00:00Z' })
  connectedAt?: Date | null;

  @ApiPropertyOptional({ example: '2025-02-02T10:30:00Z' })
  lastActive?: Date | null;

  @ApiProperty({ example: '2025-02-02T09:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-02-02T10:00:00Z' })
  updatedAt: Date;

  @ApiProperty({
    description: 'When false, AI inbox auto-reply is disabled for this WhatsApp account',
    example: true,
  })
  aiAutoReplyEnabled: boolean;

  @ApiProperty({
    description: 'When true, follow-up autopilot may run for this WhatsApp account (admin-enabled)',
    example: false,
  })
  followupAutopilotEnabled: boolean;

  @ApiProperty({
    description: 'Staff phones allowed to use CRM AI by messaging this WhatsApp account',
    type: [String],
  })
  staffAiAllowedNumbers: string[];

  @ApiPropertyOptional({
    description: 'True while post-connect enrichment runs in the background',
  })
  backgroundSyncing?: boolean;

  @ApiPropertyOptional({
    description: 'Runtime status hint (connect/sync progress)',
  })
  statusMessage?: string;

  @ApiPropertyOptional({ example: 'socks5://user:***@proxy.example.com:1080' })
  proxyUrl?: string | null;

  @ApiPropertyOptional({ enum: ['http', 'https', 'socks4', 'socks5'], example: 'socks5' })
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5' | null;

  @ApiPropertyOptional({
    description:
      'True while QR linking is in progress — health monitor and auto-reconnect are paused',
  })
  linkingMode?: boolean;

  @ApiPropertyOptional({
    description: 'Per-session engine override (null = inherit global ENGINE_TYPE)',
    enum: ['whatsapp-web.js', 'baileys'],
  })
  engineType?: string | null;

  @ApiPropertyOptional({
    description: 'Resolved engine for this session (override or global default)',
    enum: ['whatsapp-web.js', 'baileys'],
  })
  effectiveEngineType?: string;

  @ApiPropertyOptional({
    description: 'Whether on-disk auth exists for the effective engine',
  })
  engineAuthPresent?: boolean;

  @ApiPropertyOptional({
    description: 'Phone is stored but effective engine has no auth — scan QR again',
  })
  requiresRelink?: boolean;

  @ApiPropertyOptional({
    description: 'Why requiresRelink is true (alternate_engine vs incomplete/missing auth)',
    enum: ['alternate_engine', 'auth_missing'],
  })
  relinkReason?: SessionRelinkReason | null;
}

export class QRCodeResponseDto {
  @ApiProperty({
    description: 'QR code as data URL',
    example: 'data:image/png;base64,...',
  })
  qrCode: string;

  @ApiProperty({ enum: SessionStatus, example: SessionStatus.QR_READY })
  status: SessionStatus;

  @ApiPropertyOptional({
    description: 'Human-readable status hint for QR/connect flow',
  })
  statusMessage?: string;

  @ApiPropertyOptional({
    description: 'Failure reason code when status is failed',
    example: 'auth_failure',
  })
  failureCode?: string;

  @ApiPropertyOptional({
    description: 'True while post-connect enrichment runs in the background',
  })
  backgroundSyncing?: boolean;
}
