import { Capacitor, registerPlugin } from '@capacitor/core';
import type { SmsReaderPlugin } from './ussd_engine/SmsReaderPlugin.types';

const SmsReader = registerPlugin<SmsReaderPlugin>('SmsReader');

export class SmsListenerService {
  private static isListening = false;

  static async startListening(callback: (message: string, address?: string) => void): Promise<void> {
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
        const address = sms.address || sms.originatingAddress || sms.phone || "";
        console.log("📩 SMS received:", body);
        callback(body, address);
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

  /** Heuristique expéditeur / corps pour SMS liés MTN MoMo (évite les SMS « transaction » sans lien MoMo). */
  static isLikelyMtnMomoMessage(address: string | undefined, body: string): boolean {
    const addr = (address || "").trim();
    const lowerA = addr.toLowerCase();
    const lowerB = body.toLowerCase();
    if (/mtn|momo|mobile money|momob|momopay|882|880|yello/i.test(lowerA)) return true;
    if (/mtn mobile|mobile money|\bmomo\b|mtn momo|yello wallet/i.test(lowerB)) return true;
    if (/(fcfa|f\s*cfa|xof)/i.test(lowerB) && /\b(solde|momo|nouveau solde|mobile money)\b/i.test(lowerB)) {
      return true;
    }
    return false;
  }

  static async readBalanceFromSmsHistory(limit: number = 150): Promise<number | null> {
    console.log("🔍 [SMS] Reading balance from SMS history (limit:", limit, ")");
    
    if (!Capacitor.isNativePlatform()) {
      console.warn("SMS reading is only supported on native devices.");
      return null;
    }

    try {
      const result = await SmsReader.getSmsHistory({ limit });
      console.log(`📥 [SMS] Found ${result.count} messages`);
      
      const pickLatest = (messages: typeof result.messages) => {
        let best: { date: number; priority: number; value: number } | null = null;
        for (const sms of messages) {
          const hit = this.extractBalanceWithPriority(sms.body);
          if (hit === null) continue;
          if (
            best === null ||
            sms.date > best.date ||
            (sms.date === best.date && hit.priority > best.priority)
          ) {
            best = { date: sms.date, priority: hit.priority, value: hit.value };
            console.log(
              `💰 [SMS] Candidat solde: ${hit.value} FCFA (prio ${hit.priority}, date ${new Date(sms.date).toISOString()})`
            );
          }
        }
        return best?.value ?? null;
      };

      const mtnRelated = result.messages.filter((m) => this.isLikelyMtnMomoMessage(m.address, m.body));
      let latestBalance = pickLatest(mtnRelated.length > 0 ? mtnRelated : result.messages);
      if (latestBalance === null && mtnRelated.length > 0) {
        latestBalance = pickLatest(result.messages);
      }

      if (latestBalance !== null) {
        console.log("✅ [SMS] Latest balance found:", latestBalance, "FCFA");
      } else {
        console.log("⚠️ [SMS] No balance found in SMS history");
      }

      return latestBalance;
    } catch (e) {
      console.error("❌ [SMS] Error reading SMS history:", e);
      return null;
    }
  }

  /** Parse un montant FCFA typique SMS (séparateurs milliers . ou espace). */
  private static parseFcfaAmount(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    const noSpaces = t.replace(/\s/g, "");
    if (/^\d{1,3}(\.\d{3})+$/.test(noSpaces)) {
      const n = parseInt(noSpaces.replace(/\./g, ""), 10);
      return Number.isNaN(n) ? null : n;
    }
    const digits = noSpaces.replace(/\./g, "").replace(",", "");
    const n = parseInt(digits, 10);
    return Number.isNaN(n) || n < 0 ? null : n;
  }

  /**
   * Extrait le solde avec une priorité (évite de prendre le montant du transfert au lieu du solde).
   * Plus la priorité est élevée, plus la formulation indique explicitement le solde restant.
   */
  static extractBalanceWithPriority(message: string): { value: number; priority: number } | null {
    const rules: { re: RegExp; priority: number }[] = [
      { re: /nouveau\s+solde\s+est\s+de\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 100 },
      { re: /nouveau\s+solde\s*[:=]\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 98 },
      { re: /votre\s+nouveau\s+solde\s+(?:est\s+)?(?:de\s*)?([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 97 },
      { re: /solde\s+restant\s*(?:est\s+)?(?:de\s*)?\s*[:]?\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 96 },
      { re: /solde\s+disponible\s*(?:est\s+)?(?:de\s*)?\s*[:]?\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 95 },
      { re: /votre\s+solde\s+momo\s+est\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 92 },
      { re: /votre\s+solde\s+est\s+de\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 90 },
      { re: /solde\s+momo\s*[:=]\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 88 },
      { re: /solde\s+actuel\s*(?:est\s+)?(?:de\s*)?\s*[:]?\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/i, priority: 85 },
      { re: /(?:^|[.!\n])\s*solde\s*:\s*([\d\s.,]+)\s*(?:FCFA|F\s*CFA|XOF)\b/im, priority: 72 },
    ];

    let best: { value: number; priority: number } | null = null;
    for (const { re, priority } of rules) {
      const m = message.match(re);
      if (!m?.[1]) continue;
      const value = this.parseFcfaAmount(m[1]);
      if (value === null) continue;
      if (!best || priority > best.priority) best = { value, priority };
    }

    if (best) {
      console.log("💰 [SMS] Meilleur solde dans le message:", best.value, "FCFA (priorité", best.priority, ")");
    } else {
      console.log("⚠️ [SMS] Aucun solde fiable dans le message");
    }
    return best;
  }

  /** Compat : meilleur solde déduit du corps du SMS. */
  static extractBalance(message: string): number | null {
    return this.extractBalanceWithPriority(message)?.value ?? null;
  }
}
