export enum SmsProvider {
  MOBISHASTRA = 'mobishastra',
}

export enum SmsProviderStatus {
  NOT_CONNECTED = 'not_connected',
  TESTING = 'testing',
  CONNECTED = 'connected',
  LOW_BALANCE = 'low_balance',
  FAILED = 'failed',
  DISABLED = 'disabled',
}

export enum SmsMessageStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

export const SMS_SETTINGS_ID = 'default';
export const SMS_LOW_BALANCE_THRESHOLD = 100;

export type SmsSendChannel = 'whatsapp' | 'sms' | 'both';
