import { PluginListenerHandle } from '@capacitor/core';

export interface UssdBackgroundPlugin {
  executeUssd(options: { code: string }): Promise<{ status: string; type?: string; message?: string; isFinal?: boolean }>;
  addListener(eventName: 'ussdEvent', listenerFunc: (event: { type: string; message?: string; failureCode?: number; isFinal?: boolean }) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
}
