import { AppLauncher } from '@capacitor/app-launcher';

/**
 * Service USSD pour exécuter les codes MTN Mobile Money
 * Utilise Capacitor AppLauncher pour ouvrir l'application téléphone avec le code USSD
 */

// Codes USSD MTN Bénin
const MTN_USSD_CODES = {
  balance: '*123#',                    // Solde MTN
  data_balance: '*144#',               // Solde données
  credit_recharge: '*507#',            // Recharger crédit
  momo_balance: '*105#',                // Solde MTN Money
  momo_send: '*105*1#',                // Envoyer argent
  momo_receive: '*105*2#',              // Retirer argent
  momo_deposit: '*105*3#',              // Déposer argent
  momo_history: '*105*4#',             // Historique transactions
  transfer: '*105*1#',                  // Transfert (alias momo_send)
} as const;

type USSDCodeType = keyof typeof MTN_USSD_CODES;

interface USSDParams {
  destinationNumber?: string;
  amount?: string | number;
}

/**
 * Construit le code USSD complet avec paramètres
 */
function buildUSSDCode(codeType: USSDCodeType, params?: USSDParams): string {
  const baseCode = MTN_USSD_CODES[codeType];

  if (!baseCode) {
    throw new Error(`Type de code USSD inconnu: ${codeType}`);
  }

  // Pour les transferts, construire le code complet
  if ((codeType === 'momo_send' || codeType === 'transfer') && params?.destinationNumber) {
    // Format: *105*1*NUMERO*MONTANT#
    const amount = params.amount || '';
    return `*105*1*${params.destinationNumber}*${amount}#`;
  }

  return baseCode;
}

/**
 * Exécute un code USSD en ouvrant l'application téléphone
 */
export async function executeUSSD(
  codeType: USSDCodeType,
  params?: USSDParams
): Promise<{ success: boolean; message: string; ussdCode: string }> {
  try {
    const ussdCode = buildUSSDCode(codeType, params);

    // Encoder le code USSD pour l'URL
    // Format tel: pour les codes USSD avec # encodé comme %23
    const encodedUSSD = ussdCode.replace('#', '%23');
    const phoneUrl = `tel:${encodedUSSD}`;

    console.log('📱 [USSD] Exécution du code:', ussdCode);
    console.log('🔗 [USSD] URL:', phoneUrl);

    // Vérifier si l'URL peut être ouverte
    const { value: canOpen } = await AppLauncher.canOpenUrl({ url: phoneUrl });

    if (!canOpen) {
      console.error('❌ [USSD] Impossible d\'ouvrir l\'application téléphone');
      return {
        success: false,
        message: 'Impossible d\'ouvrir l\'application téléphone',
        ussdCode,
      };
    }

    // Ouvrir l'application téléphone avec le code USSD
    await AppLauncher.openUrl({ url: phoneUrl });

    console.log('✅ [USSD] Code USSD ouvert dans l\'application téléphone');

    return {
      success: true,
      message: `Code USSD ${ussdCode} ouvert. Confirmez sur votre téléphone.`,
      ussdCode,
    };

  } catch (error) {
    console.error('❌ [USSD] Erreur:', error);
    return {
      success: false,
      message: `Erreur: ${(error as Error).message}`,
      ussdCode: '',
    };
  }
}

/**
 * Exécute une commande vocale parsée via USSD
 */
export async function executeVoiceCommand(
  intent: string,
  data?: {
    amount?: number;
    recipient?: string;
  }
): Promise<{ success: boolean; message: string; action: string }> {
  console.log('🎙️ [USSD] Exécution commande vocale:', intent, data);

  switch (intent) {
    case 'balance':
    case 'check_balance': {
      const result = await executeUSSD('balance');
      return {
        success: result.success,
        message: result.message,
        action: 'Consulter solde MTN',
      };
    }

    case 'momo_balance': {
      const result = await executeUSSD('momo_balance');
      return {
        success: result.success,
        message: result.message,
        action: 'Consulter solde MTN Money',
      };
    }

    case 'transfer':
    case 'momo_send': {
      if (!data?.recipient || !data?.amount) {
        return {
          success: false,
          message: 'Numéro de destination et montant requis pour le transfert',
          action: 'Transfert MTN Money',
        };
      }
      const result = await executeUSSD('momo_send', {
        destinationNumber: data.recipient,
        amount: data.amount,
      });
      return {
        success: result.success,
        message: result.message,
        action: 'Envoyer argent MTN Money',
      };
    }

    case 'recharge':
    case 'credit_recharge': {
      const result = await executeUSSD('credit_recharge');
      return {
        success: result.success,
        message: result.message,
        action: 'Recharger crédit',
      };
    }

    case 'momo_history': {
      const result = await executeUSSD('momo_history');
      return {
        success: result.success,
        message: result.message,
        action: 'Historique MTN Money',
      };
    }

    default:
      return {
        success: false,
        message: `Action non supportée: ${intent}`,
        action: 'Inconnu',
      };
  }
}

// Export pour utilisation dans les composants
export { MTN_USSD_CODES };
export type { USSDCodeType, USSDParams };
