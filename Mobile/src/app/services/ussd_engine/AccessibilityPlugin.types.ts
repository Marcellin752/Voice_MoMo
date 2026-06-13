import { PluginListenerHandle } from '@capacitor/core';

export interface AccessibilityPluginInterface {
  isEnabled(): Promise<{ enabled: boolean }>;
  setTransactionActive(options: { active: boolean }): Promise<void>;
  cachePinSecurely(options: { pin: string }): Promise<void>;
  cacheRecipient(options: { recipient: string }): Promise<void>;
  executeUssd(options: { code: string }): Promise<void>;
  addListener(eventName: 'ussdAutoEvent', listenerFunc: (event: { status: string; message: string }) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
}
