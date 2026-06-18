import { request } from '../utils/api';

export type VoiceCommandResponse = {
  intent: 'balance' | 'transfer' | 'topup' | 'payment' | 'unknown';
  amount?: number;
  message: string;
};

export function sendVoiceCommand(command: string) {
  return request<VoiceCommandResponse>('POST', '/api/voice/command', { command });
}
