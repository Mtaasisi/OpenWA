import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { SmsService } from './sms.service';
import {
  BulkSmsDto,
  SendSmsDto,
  SmsSettingsDto,
  TestSmsDto,
} from './dto/sms-settings.dto';

@ApiTags('sms')
@ApiBearerAuth()
@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Get('status')
  @ApiOperation({ summary: 'SMS channel status (no secrets)' })
  getStatus() {
    return this.smsService.getStatus();
  }

  @Get('settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Get SMS provider settings (masked)' })
  getSettings() {
    return this.smsService.getSettings();
  }

  @Post('settings')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Save SMS provider credentials' })
  saveSettings(@Body() dto: SmsSettingsDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.smsService.saveSettings(dto, apiKey.id);
  }

  @Post('test')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send test SMS' })
  testSms(@Body() dto: TestSmsDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.smsService.testSms(dto, apiKey.id);
  }

  @Get('balance')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Check MobiShastra balance' })
  checkBalance(@CurrentApiKey() apiKey: ApiKey) {
    return this.smsService.checkBalance(apiKey.id);
  }

  @Post('send')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send single SMS' })
  send(@Body() dto: SendSmsDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.smsService.send(dto, apiKey);
  }

  @Post('bulk-send')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Send bulk SMS' })
  bulkSend(@Body() dto: BulkSmsDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.smsService.bulkSend(dto, apiKey);
  }

  @Get('logs')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'List SMS message logs' })
  getLogs(
    @CurrentApiKey() apiKey: ApiKey,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('period') period?: string,
    @Query('sentBy') sentBy?: string,
  ) {
    return this.smsService.getLogs(apiKey, { status, q, period, sentBy });
  }

  @Post('disable')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Disable SMS provider' })
  disable(@CurrentApiKey() apiKey: ApiKey) {
    return this.smsService.disable(apiKey.id);
  }

  @Post('activate')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Activate SMS provider' })
  activate(@CurrentApiKey() apiKey: ApiKey) {
    return this.smsService.activate(apiKey.id);
  }

  @Post('preview-segments')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Preview SMS segment count' })
  previewSegments(@Body() body: { message: string }) {
    return this.smsService.previewSegments(body.message ?? '');
  }
}
