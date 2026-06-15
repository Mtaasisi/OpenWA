import { Injectable, Logger } from '@nestjs/common';
import type {
  SmsBalanceResult,
  SmsProviderCredentials,
  SmsProviderInterface,
  SmsSendResult,
} from '../sms-provider.interface';
import { parseMobishastraResponse } from '../utils/mobishastra-codes.util';

const BASE_URL = 'https://mshastra.com';

@Injectable()
export class MobishastraProvider implements SmsProviderInterface {
  private readonly logger = new Logger(MobishastraProvider.name);

  private buildParams(
    credentials: SmsProviderCredentials,
    extra: Record<string, string>,
  ): URLSearchParams {
    return new URLSearchParams({
      user: credentials.user,
      pwd: credentials.password,
      senderid: credentials.senderId,
      priority: credentials.priority,
      CountryCode: credentials.countryCode,
      ShowError: 'C',
      ...extra,
    });
  }

  private parseSendResponse(raw: string): SmsSendResult {
    const trimmed = raw.trim();
    const parsed = parseMobishastraResponse(trimmed);
    return {
      success: parsed.success,
      code: parsed.code,
      message: parsed.message,
      rawResponse: trimmed,
      providerMessageId: parsed.success ? trimmed : undefined,
    };
  }

  private async httpGet(url: string): Promise<string> {
    try {
      const res = await fetch(url, { method: 'GET' });
      return await res.text();
    } catch (err) {
      this.logger.warn(`MobiShastra HTTP error: ${(err as Error).message}`);
      throw err;
    }
  }

  async sendSingle(
    credentials: SmsProviderCredentials,
    phone: string,
    message: string,
  ): Promise<SmsSendResult> {
    const params = this.buildParams(credentials, {
      mobileno: phone,
      msgtext: message,
    });
    const url = `${BASE_URL}/sendurl.aspx?${params.toString()}`;
    const raw = await this.httpGet(url);
    return this.parseSendResponse(raw);
  }

  async sendBulk(
    credentials: SmsProviderCredentials,
    phones: string[],
    message: string,
  ): Promise<SmsSendResult> {
    const params = this.buildParams(credentials, {
      mobileno: phones.join(','),
      msgtext: message,
    });
    const url = `${BASE_URL}/sendurlcomma.aspx?${params.toString()}`;
    const raw = await this.httpGet(url);
    return this.parseSendResponse(raw);
  }

  async checkBalance(credentials: SmsProviderCredentials): Promise<SmsBalanceResult> {
    const params = new URLSearchParams({
      user: credentials.user,
      pwd: credentials.password,
      ShowError: 'C',
    });
    const url = `${BASE_URL}/balance.aspx?${params.toString()}`;
    const raw = await this.httpGet(url);
    const trimmed = raw.trim();

    const parsed = parseMobishastraResponse(trimmed);
    if (!parsed.success && parsed.code !== 'ERR') {
      return {
        success: false,
        balance: null,
        rawResponse: trimmed,
        errorMessage: parsed.message,
      };
    }

    const numMatch = trimmed.match(/[\d.]+/);
    const balance = numMatch ? parseFloat(numMatch[0]) : null;

    return {
      success: balance !== null && !Number.isNaN(balance),
      balance,
      rawResponse: trimmed,
      errorMessage: balance === null ? trimmed.slice(0, 200) || 'Could not parse balance response' : undefined,
    };
  }
}
