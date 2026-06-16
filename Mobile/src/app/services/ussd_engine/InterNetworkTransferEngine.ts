import { NetworkDetector, MobileNetwork } from '../engine/NetworkDetector';

/**
 * Engine pour gérer les transferts inter-réseau au Bénin
 * - MTN → MTN : directement via code USSD MTN
 * - MTN → Moov/Celtis : via Linka Send
 */
/**
 * Engine pour transferts inter-réseau.
 *
 * ⚠️ IMPORTANT : Suppose que les numéros reçus sont DÉJÀ validés et formatés
 * par ContactResolverService.formatBeninNumber() en amont.
 *
 * Ne pas ajouter de validation redondante ici — faire confiance aux données.
 */
export class InterNetworkTransferEngine {
  private senderPhone: string;
  private recipientPhone: string;
  private senderNetwork: MobileNetwork;
  private recipientNetwork: MobileNetwork;

  constructor(senderPhone: string, recipientPhone: string) {
    this.senderPhone = senderPhone;
    this.recipientPhone = recipientPhone;

    // Détection simple (pas de validation, les données sont déjà validées en amont)
    this.senderNetwork = NetworkDetector.detectNetwork(senderPhone);
    this.recipientNetwork = NetworkDetector.detectNetwork(recipientPhone);

    console.log(`\n📱 [INTER-NETWORK] Engine créé`);
    console.log(`   Sender: ${senderPhone} (${NetworkDetector.getNetworkLabel(this.senderNetwork)})`);
    console.log(`   Recipient: ${recipientPhone} (${NetworkDetector.getNetworkLabel(this.recipientNetwork)})\n`);
  }

  /**
   * Construit le code USSD approprié selon la combinaison de réseaux
   */
  buildUSSDCode(amount: number): string {
    console.log(`🔨 [INTER-NETWORK] Construction code USSD - Montant: ${amount} XOF`);

    // Cas 1 : MTN → MTN (transfert interne MTN, direct)
    if (this.senderNetwork === MobileNetwork.MTN && this.recipientNetwork === MobileNetwork.MTN) {
      const code = `*880*1*1*${this.recipientPhone}*${this.recipientPhone}*${amount}#`;
      console.log(`✅ [INTER-NETWORK] MTN→MTN (Direct): ${code}`);
      return code;
    }

    // Cas 2 : MTN → Autre réseau (via Linka Send)
    // Format Linka : *601*16*{NUMERO}*{CODE_RESEAU}*{MONTANT}#
    if (this.senderNetwork === MobileNetwork.MTN) {
      const networkCode = NetworkDetector.getNetworkCode(this.recipientNetwork);
      const code = `*601*16*${this.recipientPhone}*${networkCode}*${amount}#`;
      console.log(`✅ [INTER-NETWORK] MTN→${this.recipientNetwork} (Linka): ${code}`);
      return code;
    }

    // Autres cas : non supportés pour l'instant
    throw new Error(`❌ Transfert de ${NetworkDetector.getNetworkLabel(this.senderNetwork)} non encore supporté. Seul MTN peut initier des transferts.`);
  }

  /**
   * Calcule les frais de transfert
   */
  getTransferFees(amount: number): number {
    // MTN → MTN : gratuit
    if (this.senderNetwork === MobileNetwork.MTN && this.recipientNetwork === MobileNetwork.MTN) {
      return 0;
    }

    // MTN → Autre (via Linka) : frais variables (à confirmer avec Linka)
    if (this.senderNetwork === MobileNetwork.MTN) {
      if (amount <= 10000) return 100;
      if (amount <= 50000) return 500;
      return 1000;
    }

    return 0;
  }

  /**
   * Retourne les informations sur le transfert
   */
  getTransferInfo(): {
    senderNetwork: MobileNetwork;
    recipientNetwork: MobileNetwork;
    isSameNetwork: boolean;
    service: string; // "Direct MTN" ou "Linka Send"
  } {
    const isSameNetwork = this.senderNetwork === this.recipientNetwork && this.senderNetwork === MobileNetwork.MTN;
    const service = isSameNetwork ? 'Direct MTN' : 'Linka Send';

    return {
      senderNetwork: this.senderNetwork,
      recipientNetwork: this.recipientNetwork,
      isSameNetwork,
      service
    };
  }

  /**
   * Vérifie si le transfert est possible
   */
  canExecuteTransfer(): { canExecute: boolean; reason?: string } {
    // Seul MTN peut initier des transferts pour l'instant
    if (this.senderNetwork !== MobileNetwork.MTN) {
      return {
        canExecute: false,
        reason: `❌ Seuls les utilisateurs MTN peuvent effectuer des transferts vocaux pour l'instant.`
      };
    }

    // MTN peut transférer vers tous les réseaux
    return { canExecute: true };
  }

  /**
   * Exécute le transfert (prépare les données)
   */
  async executeTransfer(amount: number): Promise<{
    status: string;
    ussdCode: string;
    fees: number;
    totalAmount: number;
    service: string;
    message: string;
  }> {
    // Vérifier si possible
    const check = this.canExecuteTransfer();
    if (!check.canExecute) {
      throw new Error(check.reason);
    }

    // Construire le code
    const ussdCode = this.buildUSSDCode(amount);
    const fees = this.getTransferFees(amount);
    const totalAmount = amount + fees;
    const info = this.getTransferInfo();

    console.log(`\n💰 [INTER-NETWORK] Résumé du transfert:`);
    console.log(`   Montant: ${amount} XOF`);
    console.log(`   Frais: ${fees} XOF`);
    console.log(`   Total: ${totalAmount} XOF`);
    console.log(`   Service: ${info.service}`);
    console.log(`   USSD: ${ussdCode}\n`);

    return {
      status: 'initiated',
      ussdCode,
      fees,
      totalAmount,
      service: info.service,
      message: `Transfert de ${amount} XOF vers ${this.recipientPhone} via ${info.service} initié.`
    };
  }
}
