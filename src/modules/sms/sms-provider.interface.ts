export interface SmsProviderCredentials {
  user: string;
  password: string;
  senderId: string;
  countryCode: string;
  priority: string;
}

export interface SmsSendResult {
  success: boolean;
  code: string;
  message: string;
  rawResponse: string;
  providerMessageId?: string;
}

export interface SmsBalanceResult {
  success: boolean;
  balance: number | null;
  rawResponse: string;
  errorMessage?: string;
}

export interface SmsProviderInterface {
  sendSingle(
    credentials: SmsProviderCredentials,
    phone: string,
    message: string,
  ): Promise<SmsSendResult>;

  sendBulk(
    credentials: SmsProviderCredentials,
    phones: string[],
    message: string,
  ): Promise<SmsSendResult>;

  checkBalance(credentials: SmsProviderCredentials): Promise<SmsBalanceResult>;
}
