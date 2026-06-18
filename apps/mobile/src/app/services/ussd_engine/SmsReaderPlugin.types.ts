import { PluginListenerHandle } from '@capacitor/core';

export interface SmsMessage {
  address: string;
  body: string;
  date: number;
  type: number;
}

export interface SmsReaderPlugin {
  getSmsHistory(options?: { limit?: number }): Promise<{ messages: SmsMessage[]; count: number }>;
}
