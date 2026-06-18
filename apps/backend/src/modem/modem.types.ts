/**
 * Contrat commun modem réel / mock.
 */
export interface IModemClient {
  connect(): Promise<void>;
  sendUSSD(code: string): Promise<string>;
  replyUSSD(response: string): Promise<string>;
  cancelUSSD(): Promise<void>;
  isAlive(): Promise<boolean>;
  getSignalStrength(): Promise<number>;
  disconnect(): Promise<void>;
}
