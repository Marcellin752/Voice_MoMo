import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';

/**
 * Service USSD pour exécuter les codes MTN Mobile Money Bénin
 * Utilise Capacitor AppLauncher pour ouvrir l'application téléphone avec le code USSD
 * 
 * Codes USSD réels MTN MoMo Bénin:
 * - Menu principal: *880#
 * - Toutes les opérations passent par *880# (envoi, dépôt, retrait, solde, etc.)
 */

// Codes USSD MTN MoMo Bénin (codes réels)
const MTN_USSD_CODES = {
  // Opérations MoMo (tout passe par *880#)
  momo_menu: '*880#',              // Menu principal MoMo
  momo_balance: '*880#',           // Consulter solde MoMo (via menu)
  momo_send: '*880#',              // Envoyer argent (via menu → option envoi)
  momo_deposit: '*880#',           // Dépôt d'argent (via menu)
  momo_withdraw: '*880#',          // Retrait d'argent (via menu)
  momo_history: '*880#',           // Historique transactions (via menu)

  // Opérations réseau MTN
  balance: '*123#',                // Solde crédit téléphonique MTN
  data_balance: '*123*4#',         // Solde données/internet
  credit_recharge: '*880#',        // Recharger crédit via MoMo

  // Alias pour compatibilité
  transfer: '*880#',               // Transfert (alias momo_send)
  deposit: '*880#',                // Dépôt (alias momo_deposit)
  withdraw: '*880#',               // Retrait (alias momo_withdraw)
} as const;

type USSDCodeType = keyof typeof MTN_USSD_CODES;

interface USSDParams {
  destinationNumber?: string;
  amount?: string | number;
}

/**
 * Résoudre un nom de contact en numéro de téléphone
 * Cherche dans les contacts du téléphone
 */
async function resolveContactByName(name: string): Promise<string | null> {
  if (!name) return null;
  
  // Si c'est déjà un numéro de téléphone, le retourner directement
  const digitsOnly = name.replace(/\D/g, '');
  if (digitsOnly.length >= 8) {
    return digitsOnly;
  }

  // Chercher dans les contacts natifs (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      const { Contacts } = await import('@capacitor-community/contacts');

      // Vérifier les permissions
      const currentPermission = await Contacts.checkPermissions();
      const permission =
        currentPermission.contacts === 'granted'
          ? currentPermission
          : await Contacts.requestPermissions();

      if (permission.contacts !== 'granted' && permission.contacts !== 'limited') {
        console.warn('⚠️ [CONTACTS] Permission refusée pour accéder aux contacts');
        return null;
      }

      // Récupérer tous les contacts
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
        },
      });

      const searchName = name.toLowerCase().trim();
      console.log(`🔍 [CONTACTS] Recherche de "${searchName}" dans ${result.contacts.length} contacts`);

      // Chercher le contact correspondant (recherche flexible)
      for (const contact of result.contacts) {
        const displayName = (contact as any).name?.display?.toLowerCase()?.trim() || '';
        const givenName = (contact as any).name?.given?.toLowerCase()?.trim() || '';
        const familyName = (contact as any).name?.family?.toLowerCase()?.trim() || '';

        // Match sur le nom complet, prénom ou nom de famille
        const isMatch =
          displayName.includes(searchName) ||
          searchName.includes(displayName) ||
          givenName === searchName ||
          familyName === searchName ||
          givenName.startsWith(searchName) ||
          displayName.startsWith(searchName);

        if (isMatch) {
          const phones = (contact as any).phones || [];
          if (phones.length > 0) {
            const phone = phones[0].number?.replace(/[\s.-]/g, '') || '';
            if (phone) {
              console.log(`✅ [CONTACTS] Trouvé: "${displayName}" → ${phone}`);
              return phone;
            }
          }
        }
      }

      console.warn(`⚠️ [CONTACTS] Aucun contact trouvé pour "${name}"`);
      return null;
    } catch (error) {
      console.error('❌ [CONTACTS] Erreur accès contacts:', error);
      return null;
    }
  }

  // Sur web, pas d'accès aux contacts
  console.warn('⚠️ [CONTACTS] Résolution de contacts non disponible en mode web');
  return null;
}

/**
 * Construit le code USSD complet avec paramètres
 * Pour MTN Bénin, la plupart des opérations MoMo passent par *880#
 */
function buildUSSDCode(codeType: USSDCodeType, params?: USSDParams): string {
  const baseCode = MTN_USSD_CODES[codeType];

  if (!baseCode) {
    throw new Error(`Type de code USSD inconnu: ${codeType}`);
  }

  // Pour MTN Bénin, *880# est le menu principal 
  // Les paramètres sont entrés via le menu interactif USSD
  // On peut quand même tenter de pré-remplir certains champs
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
    const encodedUSSD = ussdCode.replace(/#/g, '%23');
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

    // Message contextuel selon le type d'opération
    let actionDesc = 'opération';
    if (codeType === 'momo_send' || codeType === 'transfer') {
      actionDesc = params?.destinationNumber
        ? `envoi de ${params.amount || ''} FCFA à ${params.destinationNumber}`
        : 'envoi d\'argent';
    } else if (codeType === 'momo_deposit' || codeType === 'deposit') {
      actionDesc = params?.destinationNumber
        ? `dépôt de ${params.amount || ''} FCFA pour ${params.destinationNumber}`
        : 'dépôt d\'argent';
    } else if (codeType === 'momo_balance') {
      actionDesc = 'consultation de solde MoMo';
    } else if (codeType === 'balance') {
      actionDesc = 'consultation de solde';
    } else if (codeType === 'momo_withdraw' || codeType === 'withdraw') {
      actionDesc = `retrait de ${params?.amount || ''} FCFA`;
    } else if (codeType === 'credit_recharge') {
      actionDesc = `recharge de ${params?.amount || ''} FCFA`;
    }

    return {
      success: true,
      message: `Menu MoMo ouvert (${ussdCode}). Suivez les instructions pour: ${actionDesc}. Confirmez sur votre téléphone.`,
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
 * Résout les noms de contacts en numéros de téléphone automatiquement
 */
export async function executeVoiceCommand(
  intent: string,
  data?: {
    amount?: number;
    recipient?: string;
  }
): Promise<{ success: boolean; message: string; action: string }> {
  console.log('🎙️ [USSD] Exécution commande vocale:', intent, data);

  // Résoudre le recipient (nom → numéro) si nécessaire
  let resolvedRecipient = data?.recipient || '';
  if (resolvedRecipient && resolvedRecipient.replace(/\D/g, '').length < 8) {
    // C'est un nom, pas un numéro - essayer de résoudre via les contacts
    console.log(`🔍 [USSD] Résolution du contact "${resolvedRecipient}"...`);
    const resolvedPhone = await resolveContactByName(resolvedRecipient);
    if (resolvedPhone) {
      console.log(`✅ [USSD] Contact résolu: "${resolvedRecipient}" → ${resolvedPhone}`);
      resolvedRecipient = resolvedPhone;
    } else {
      console.warn(`⚠️ [USSD] Contact "${resolvedRecipient}" non trouvé dans les contacts`);
      // On continue quand même - le menu USSD demandera le numéro
    }
  }

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
        action: 'Consulter solde MTN MoMo',
      };
    }

    case 'transfer':
    case 'momo_send': {
      const result = await executeUSSD('momo_send', {
        destinationNumber: resolvedRecipient,
        amount: data?.amount,
      });

      const recipientLabel = data?.recipient !== resolvedRecipient
        ? `${data?.recipient} (${resolvedRecipient})`
        : resolvedRecipient || 'destinataire';

      return {
        success: result.success,
        message: resolvedRecipient
          ? `Menu MoMo ouvert (*880#). Sélectionnez "Envoi d'argent" pour envoyer ${data?.amount || ''} FCFA à ${recipientLabel}.`
          : result.message,
        action: 'Envoyer argent MTN MoMo',
      };
    }

    case 'deposit':
    case 'momo_deposit': {
      const result = await executeUSSD('momo_deposit', {
        destinationNumber: resolvedRecipient,
        amount: data?.amount,
      });

      const recipientLabel = data?.recipient !== resolvedRecipient
        ? `${data?.recipient} (${resolvedRecipient})`
        : resolvedRecipient || 'destinataire';

      return {
        success: result.success,
        message: resolvedRecipient
          ? `Menu MoMo ouvert (*880#). Effectuez le dépôt de ${data?.amount || ''} FCFA pour ${recipientLabel}.`
          : result.message,
        action: 'Dépôt MTN MoMo',
      };
    }

    case 'withdraw':
    case 'momo_withdraw': {
      const result = await executeUSSD('momo_withdraw', {
        amount: data?.amount,
      });
      return {
        success: result.success,
        message: `Menu MoMo ouvert (*880#). Sélectionnez "Retrait" pour retirer ${data?.amount || ''} FCFA.`,
        action: 'Retrait MTN MoMo',
      };
    }

    case 'recharge':
    case 'credit_recharge': {
      const result = await executeUSSD('credit_recharge', {
        amount: data?.amount,
      });
      return {
        success: result.success,
        message: `Menu MoMo ouvert (*880#). Sélectionnez "Recharge" pour recharger ${data?.amount || ''} FCFA de crédit.`,
        action: 'Recharger crédit via MoMo',
      };
    }

    case 'momo_history': {
      const result = await executeUSSD('momo_history');
      return {
        success: result.success,
        message: result.message,
        action: 'Historique MTN MoMo',
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
export { MTN_USSD_CODES, resolveContactByName };
export type { USSDCodeType, USSDParams };
