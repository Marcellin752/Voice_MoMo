export enum MobileNetwork {
  MTN = 'MTN',
  MOOV = 'MOOV',
  CELTIS = 'CELTIS',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Détecte le réseau mobile (MTN, Moov, Celtis) à partir d'un numéro Bénin
 * Tous les numéros au Bénin commencent par 01, suivi de 2 chiffres distinctifs par réseau
 */
export class NetworkDetector {
  // Préfixes au Bénin : 01 + {ces chiffres}
  private static readonly MTN_SUB_PREFIXES = [
    '42', '46', '50', '51', '52', '53', '54', '56', '57', '59',
    '61', '62', '66', '67', '69', '90', '91', '96', '97'
  ];

  private static readonly MOOV_SUB_PREFIXES = [
    '45', '55', '58', '60', '63', '64', '65', '68', '94', '95', '98', '99'
  ];

  private static readonly CELTIS_SUB_PREFIXES = [
    '20', '21', '22', '23', '24', '28', '29', '40', '41', '43',
    '44', '47', '48', '49', '92', '93'
  ];

  /**
   * Détecte le réseau à partir d'un numéro de téléphone
   * @param phoneNumber Numéro au format 01XXXXXXXX ou avec formatage
   * @returns Réseau détecté
   */
  static detectNetwork(phoneNumber: string): MobileNetwork {
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Valider format Bénin (10 chiffres commençant par 01)
    if (!cleaned.startsWith('01') || cleaned.length !== 10) {
      console.warn(`⚠️ [NETWORK] Numéro invalide: ${phoneNumber}`);
      return MobileNetwork.UNKNOWN;
    }

    // Extraire les 2 chiffres après le '01' (positions 2-3)
    const subPrefix = cleaned.substring(2, 4);
    console.log(`🔍 [NETWORK] Détection - Numéro: ${cleaned}, Prefix: ${subPrefix}`);

    if (this.MTN_SUB_PREFIXES.includes(subPrefix)) {
      console.log(`   ✅ Réseau: MTN`);
      return MobileNetwork.MTN;
    }
    if (this.MOOV_SUB_PREFIXES.includes(subPrefix)) {
      console.log(`   ✅ Réseau: MOOV`);
      return MobileNetwork.MOOV;
    }
    if (this.CELTIS_SUB_PREFIXES.includes(subPrefix)) {
      console.log(`   ✅ Réseau: CELTIS`);
      return MobileNetwork.CELTIS;
    }

    console.error(`❌ [NETWORK] Réseau inconnu pour prefix: ${subPrefix}`);
    return MobileNetwork.UNKNOWN;
  }

  /**
   * Retourne le code numérique du réseau (pour codes USSD Linka)
   * @param network Réseau mobile
   * @returns 1=MTN, 2=Moov, 3=Celtis, 0=Inconnu
   */
  static getNetworkCode(network: MobileNetwork): number {
    switch (network) {
      case MobileNetwork.MTN: return 1;
      case MobileNetwork.MOOV: return 2;
      case MobileNetwork.CELTIS: return 3;
      default: return 0;
    }
  }

  /**
   * Retourne le label du réseau avec emoji
   */
  static getNetworkLabel(network: MobileNetwork): string {
    switch (network) {
      case MobileNetwork.MTN: return '🟠 MTN';
      case MobileNetwork.MOOV: return '🔵 Moov';
      case MobileNetwork.CELTIS: return '🟢 Celtis';
      default: return '❓ Inconnu';
    }
  }
}
