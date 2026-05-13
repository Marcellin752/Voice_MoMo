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
    console.log("🔍 [SMS] Analyzing message for balance:", message);
    
    // Patterns spécifiques pour MTN MoMo Bénin
    // Exemples de vrais messages MTN MoMo :
    // 1. "Vous avez reçu 5.000 FCFA de 97123456. Votre nouveau solde est de 25.000 FCFA."
    // 2. "Transaction réussie. Votre solde est de 15.500 FCFA."
    // 3. "Votre solde MoMo est 10000 FCFA."
    // 4. "Nouveau solde: 45.000 FCFA"
    
    const patterns = [
      // Pattern 1: "Votre nouveau solde est de X FCFA"
      /nouveau solde est de\s*([\d\s.,]+)\s*FCFA/i,
      // Pattern 2: "Votre solde est de X FCFA"
      /votre solde est de\s*([\d\s.,]+)\s*FCFA/i,
      // Pattern 3: "Votre solde MoMo est X FCFA"
      /votre solde momo est\s*([\d\s.,]+)\s*FCFA/i,
      // Pattern 4: "Nouveau solde: X FCFA"
      /nouveau solde:\s*([\d\s.,]+)\s*FCFA/i,
      // Pattern 5: "Solde: X FCFA"
      /solde:\s*([\d\s.,]+)\s*FCFA/i,
      // Pattern 6: "est de X FCFA" (générique)
      /est de\s*([\d\s.,]+)\s*FCFA/i,
      // Patterns generiques de secours
      /solde[\s\S]*?([\d\s.,]+)\s*(?:FCFA|F CFA|XOF|F)/i,
      /([\d\s.,]+)\s*(?:FCFA|F CFA|XOF|F)[\s\S]*?solde/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        // Nettoyer le nombre : enlever espaces et points séparateurs de milliers
        // Exemples: "5.000" -> "5000", "25 000" -> "25000", "10,000" -> "10000"
        const cleanNumber = match[1]
          .replace(/[ \.]/g, '')    // Enlever espaces et points
          .replace(',', '');         // Enlever virgules (si utilisées comme séparateur)
        const balance = parseInt(cleanNumber, 10);
        if (!isNaN(balance)) {
          console.log("💰 [SMS] Extracted balance:", balance, "FCFA");
          return balance;
        }
      }
    }
    
    console.log("⚠️ [SMS] No balance found in message");
    return null;
  }
}
