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
        // Le plugin Capacitor peut renvoyer les noms dans différents champs selon la version/plateforme
        const displayName = (contact.displayName || (contact as any).name?.display || "").toLowerCase().trim();
        const givenName = ((contact as any).name?.given || "").toLowerCase().trim();
        const familyName = ((contact as any).name?.family || "").toLowerCase().trim();
        
        const searchName = name.toLowerCase().trim();

        // Match si le nom recherché est inclus dans l'un des noms du contact
        const isMatch = 
          displayName.includes(searchName) || 
          searchName.includes(displayName) ||
          givenName.includes(searchName) ||
          familyName.includes(searchName);

        if (isMatch) {
          const phones = contact.phones || [];
          if (phones.length > 0) {
            // Récupérer le premier numéro et le nettoyer
            let phone = phones[0].number || '';
            // Enlever les espaces, tirets, parenthèses
            phone = phone.replace(/[\s.()-]/g, '');
            
            // Si le numéro commence par +229 (Bénin), on peut enlever le préfixe pour l'USSD local
            if (phone.startsWith('+229')) {
              phone = phone.substring(4);
            } else if (phone.startsWith('00229')) {
              phone = phone.substring(5);
            }
            
            if (phone) {
              console.log(`✅ [CONTACTS] Trouvé: "${displayName || name}" → ${phone}`);
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

  // Pour MTN Bénin, on peut construire des codes courts pour gagner du temps
  // Syntaxe typique: *880*Option*SousOption*Numero*Montant#
  
  if (params?.destinationNumber && params?.amount) {
    const cleanNumber = params.destinationNumber.replace(/\D/g, '');
    const cleanAmount = Math.floor(Number(params.amount));

    if (cleanNumber && cleanAmount > 0) {
      if (codeType === 'momo_send' || codeType === 'transfer') {
        return `*880*1*1*${cleanNumber}*${cleanAmount}#`;
      }
      
      if (codeType === 'momo_deposit' || codeType === 'deposit') {
        return `*880*1*1*${cleanNumber}*${cleanAmount}#`;
      }
    }
  }

  // Fallback sur le menu principal si paramètres manquants
  return baseCode;
}

/**
 * Exécute une commande via le backend V1 API (route correcte)
 * Le backend gère toute la session USSD et ne demande que le PIN
 */
export async function executeUSSDViaBackend(
  action: string,
  params?: {
    amount?: number;
    recipient?: string;
    destinationNumber?: string;
    country?: string;
  }
): Promise<{ success: boolean; message: string; action: string }> {
  try {
    // Récupérer le token d'authentification
    const tokenResponse = await fetch('/api/auth/token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!tokenResponse.ok) {
      throw new Error('Non authentifié. Veuillez vous reconnecter.');
    }

    const { token, userId } = await tokenResponse.json();

    // Chiffrer le PIN (le backend demandera le PIN via USSD)
    // Pour cette première étape, on utilise un placeholder
    const encryptedPin = 'placeholder'; // TODO: demander le PIN à l'utilisateur

    // Construire la payload pour le backend
    const payload = {
      userId,
      country: params?.country || 'BJ', // Défaut: Bénin
      action: action, // 'transfer', 'withdraw', 'balance', etc.
      params: {
        amount: params?.amount,
        to: params?.destinationNumber || params?.recipient,
      },
      encryptedPin, // Le backend demandera le PIN via la session USSD
    };

    // Appeler le backend pour exécuter la transaction
    const response = await fetch('/api/v1/transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur backend: ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      message: result.message || `${action} via backend lancé. Suivez les instructions.`,
      action,
    };
  } catch (error) {
    console.error('❌ [USSD] Erreur backend:', error);
    return {
      success: false,
      message: `Erreur: ${(error as Error).message}`,
      action: 'error',
    };
  }
}

/**
 * Exécute un code USSD en ouvrant l'application téléphone (ancienne méthode - DÉPRÉCIÉE)
 * À remplacer par executeUSSDViaBackend()
 */
export async function executeUSSD(
  codeType: USSDCodeType,
  params?: USSDParams
): Promise<{ success: boolean; message: string; ussdCode: string }> {
  try {
    const ussdCode = buildUSSDCode(codeType, params);

    // Format tel: pour les codes USSD
    // Sur Android, certains modèles préfèrent le # encodé (%23), d'autres le # brut
    const ussdCodeEncoded = ussdCode.replace(/#/g, '%23');
    const phoneUrlEncoded = `tel:${ussdCodeEncoded}`;
    const phoneUrlRaw = `tel:${ussdCode}`;

    console.log('📱 [USSD] Tentative d\'exécution:', ussdCode);

    try {
      // On tente d'abord la version encodée qui est le standard Capacitor/Web
      await AppLauncher.openUrl({ url: phoneUrlEncoded });
      console.log('✅ [USSD] Code ouvert avec succès (format encodé)');
    } catch (e) {
      console.warn('⚠️ [USSD] Échec format encodé, tentative format brut...', e);
      try {
        // Fallback sur le format brut si l'encodé échoue
        await AppLauncher.openUrl({ url: phoneUrlRaw });
        console.log('✅ [USSD] Code ouvert avec succès (format brut)');
      } catch (e2) {
        throw new Error(`Impossible d'ouvrir l'application téléphone: ${e2.message}`);
      }
    }

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
import { VoiceIntentProcessor } from './engine/VoiceIntentProcessor';

export async function executeVoiceCommand(
  intent: string,
  data?: {
    amount?: number;
    recipient?: string;
  }
): Promise<{ success: boolean; message: string; action: string }> {
  console.log('🎙️ [USSD] Exécution via VoiceIntentProcessor:', intent, data);
  const processor = new VoiceIntentProcessor();
  
  try {
    const result = await processor.processIntent({ intent, amount: data?.amount, recipient: data?.recipient });
    
    if (result && (result as any).status === 'error') {
       return { success: false, message: (result as any).message, action: intent };
    }
    
    return {
      success: true,
      message: 'Transaction en cours en arrière-plan...',
      action: intent
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Erreur inconnue',
      action: intent
    };
  }
}


// Export pour utilisation dans les composants
export { MTN_USSD_CODES, resolveContactByName };
export type { USSDCodeType, USSDParams };
