import { Capacitor } from '@capacitor/core';

export class SmsListenerService {
  private static isListening = false;

  static async startListening(callback: (message: string) => void): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.warn("SMS listening is only supported on native devices.");
      return;
    }

    try {
      if (!this.isListening) {
        if (typeof window !== 'undefined' && 'SMSReceive' in (window as any)) {
          (window as any).SMSReceive.startWatch(
            () => {
              console.log("✅ SMS Watch started");
              this.isListening = true;
            },
            (err: any) => console.error("❌ SMS Watch failed to start", err)
          );
        } else {
          console.warn("cordova-plugin-sms-receive non détecté.");
        }
      }

      document.addEventListener('onSMSArrive', (e: any) => {
        const sms = e.data || e;
        const body = sms.body || sms.text || sms.message || "";
        console.log("📩 SMS received:", body);
        callback(body);
      });
    } catch (e) {
      console.error("Error setting up SMS listener:", e);
    }
  }

  static stopListening(): void {
    if (Capacitor.isNativePlatform() && this.isListening) {
      if (typeof window !== 'undefined' && 'SMSReceive' in (window as any)) {
        (window as any).SMSReceive.stopWatch(
          () => {
            console.log("✅ SMS Watch stopped");
            this.isListening = false;
          },
          (err: any) => console.error("❌ SMS Watch failed to stop", err)
        );
      }
    }
  }

  static extractBalance(message: string): number | null {
    // Check for "solde" and numbers near "FCFA"
    const match = message.match(/solde[\s\S]*?(?:actuel)?[\s:=]+([\d\s.,]+)\s*(?:FCFA|F CFA|XOF|F)/i);
    if (match && match[1]) {
      const cleanNumber = match[1].replace(/[ \.,]/g, '');
      const balance = parseInt(cleanNumber, 10);
      if (!isNaN(balance)) return balance;
    }
    
    // Fallback MTN format
    if (/solde/i.test(message)) {
      const fbMatch = message.match(/([\d\s.,]+)\s*(?:FCFA|F CFA|XOF|F)/i);
      if (fbMatch && fbMatch[1]) {
        const cleanNumber = fbMatch[1].replace(/[ \.,]/g, '');
        const balance = parseInt(cleanNumber, 10);
        if (!isNaN(balance)) return balance;
      }
    }
    
    return null;
  }
}
