import { Capacitor } from '@capacitor/core';
import { executeUssdCodeInApp } from './ussd_engine/ussdInApp';
import { ContactResolverService } from './engine/ContactResolverService';
import { MoMoTransactionEngine } from './ussd_engine/MoMoTransactionEngine';

/**
 * Service USSD pour exécuter les codes MTN Mobile Money Bénin
 * Sur Android, les codes sont envoyés via TelephonyManager (sans ouvrir le composeur).
 * 
 * Codes USSD réels MTN MoMo Bénin:
 * - Menu principal: *880#
 * - Toutes les opérations passent par *880# (envoi, dépôt, retrait, solde, etc.)
 */

const contactResolver = new ContactResolverService();

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
    // Dynamically import or just require it if we can't
    return digitsOnly; // Will be formatted by buildUSSDCode later or formatBeninNumber. 
  }

      // Chercher dans les contacts natifs (Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          const { Contacts } = await import('@capacitor-community/contacts');
          const { ContactResolverService } = await import('./engine/ContactResolverService');
          const resolver = new ContactResolverService();

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
            const displayName = ((contact as any).displayName || (contact as any).name?.display || "").toLowerCase().trim();
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
                // Récupérer le premier numéro et le formater avec ContactResolverService
                let phone = phones[0].number || '';
                phone = resolver.formatBeninNumber(phone);
                
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
  // Syntaxe typique: *880*Option*SousOption*Numero*Numero*Montant#
  
  if (params?.destinationNumber && params?.amount) {
    // Force le formatage du numéro (ajout du 01)
    const cleanNumber = contactResolver.formatBeninNumber(params.destinationNumber);
    const cleanAmount = Math.floor(Number(params.amount));

    if (cleanNumber && cleanAmount > 0) {
      if (codeType === 'momo_send' || codeType === 'transfer') {
        return `*880*1*1*${cleanNumber}*${cleanNumber}*${cleanAmount}#`;
      }
      
      if (codeType === 'momo_deposit' || codeType === 'deposit') {
        return `*880*1*1*${cleanNumber}*${cleanNumber}*${cleanAmount}#`;
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
 * Exécute un code USSD dans l'application (TelephonyManager), sans ouvrir le composeur.
 */
export async function executeUSSD(
  codeType: USSDCodeType,
  params?: USSDParams
): Promise<{ success: boolean; message: string; ussdCode: string }> {
  try {
    const ussdCode = buildUSSDCode(codeType, params);

    console.log('📱 [USSD] Exécution in-app:', ussdCode);

    if (!Capacitor.isNativePlatform()) {
      return {
        success: false,
        message: 'Les codes USSD sont exécutés uniquement depuis l’application mobile Android.',
        ussdCode,
      };
    }

    const exec = await executeUssdCodeInApp(ussdCode);
    if (!exec.success) {
      return { success: false, message: exec.message, ussdCode };
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
      message: `${exec.message} Opération: ${actionDesc}.`,
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
): Promise<{ 
  success: boolean; 
  message: string; 
  action: string; 
  dialerFallback?: boolean;
  ambiguity?: any[];
  promptPin?: boolean;
  context?: { phone: string; amount: number; recipientName?: string };
}> {
  console.log('🎙️ [LOG] [START] executeVoiceCommand:', { intent, data });

  // PRIORITÉ ABSOLUE : RESTAURATION DU FLOW FONCTIONNEL
  // On tente le nouveau moteur, mais en cas d'échec on repasse sur le legacy immédiatement
  
  try {
    const processor = new VoiceIntentProcessor();
    console.log('🎙️ [LOG] [DEBUG] Calling VoiceIntentProcessor...');
    
    const result = await processor.processIntent({ 
      intent, 
      amount: data?.amount, 
      recipient: data?.recipient 
    });

    console.log('🎙️ [LOG] [DEBUG] Processor result:', result);

    if (result && (result as any).status === 'error') {
      return {
        success: false,
        message: (result as any).message || 'Opération impossible',
        action: intent,
      };
    }

    if (result && (result as any).error) {
      return {
        success: false,
        message: (result as any).error,
        action: intent,
      };
    }

    if (result && (result as any).status === 'unsupported') {
      return {
        success: false,
        message: (result as any).message || 'Intention non supportée',
        action: intent,
      };
    }

    if (result && (result as any).ambiguity) {
      return {
        success: false,
        ambiguity: (result as any).ambiguity,  // Tableau des contacts possibles
        message: (result as any).message || 'Plusieurs contacts possibles',
        action: intent,
      };
    }

    // Gestion de l'exécution directe (pour les transferts interactifs)
    if (result && (result as any).status === 'execute') {
      const execData = (result as any).data;
      const intentName = (result as any).intent || intent;
      
      console.log('🚀 [USSD_SERVICE] Executing direct transfer flow');
      console.log('🚀 [USSD_SERVICE] Recipient Phone:', execData.phone);
      console.log('🚀 [USSD_SERVICE] Amount:', execData.amount);
      
      // BUG #5 FIX: Ajouter try-catch pour éviter les crashes
      try {
        // On utilise le moteur pour lancer le transfert interactif
        const engine = new MoMoTransactionEngine();
        const res = await engine.startTransfer({
          amount: execData.amount,
          recipient: execData.phone
        });

        if (!res) {
          return {
            success: false,
            message: 'Erreur lors de l\'initialisation du transfert.',
            action: intentName
          };
        }

        return {
          success: res.status === 'initiated' || res.status === 'success',
          message: res.message || 'Transaction initiée.',
          action: intentName,
          dialerFallback: !!res.dialerFallback
        };
      } catch (error) {
        console.error('🔥 [USSD_SERVICE] Erreur lors du transfert:', error);
        return {
          success: false,
          message: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
          action: intentName
        };
      }
    }

    // Gestion de la demande de PIN (Legacy/Autres)
    if (result && (result as any).promptPin) {
      return {
        success: false,
        promptPin: true,
        context: (result as any).context,
        message: (result as any).message || 'Veuillez entrer votre code PIN.',
        action: intent,
      };
    }

    const okMessage =
      (result as any)?.message ||
      ((result as any)?.status === 'success' ? 'Opération lancée depuis l’application.' : 'Transaction initiée.');
    const dialerFallback = !!(result as any).dialerFallback;

    return {
      success: true,
      message: okMessage,
      action: intent,
      dialerFallback,
    };

  } catch (error: any) {
    console.error('🎙️ [LOG] [ERROR] Critical error in new engine:', error);
    console.log('🎙️ [LOG] [DEBUG] TRIGGERING LEGACY FALLBACK');
    return await executeLegacyFallback(intent, data);
  }
}

/**
 * Fallback de secours (Legacy) qui fonctionnait avant le refactor
 */
async function executeLegacyFallback(intent: string, data: any) {
  console.log('📱 [LOG] [FALLBACK] Executing Legacy USSD Flow');
  
  // Mapper l'intent vers les codes USSD legacy
  let codeType: USSDCodeType = 'momo_menu';
  if (intent === 'transfer' || intent === 'momo_send') codeType = 'momo_send';
  else if (intent === 'balance' || intent === 'momo_balance') codeType = 'momo_balance';
  else if (intent === 'deposit' || intent === 'momo_deposit') codeType = 'momo_deposit';
  
  const result = await executeUSSD(codeType, {
    destinationNumber: data?.recipient,
    amount: data?.amount
  });
  
  console.log('📱 [LOG] [FALLBACK] Legacy result:', result);
  
  return {
    success: result.success,
    message: result.message,
    action: intent,
  };
}


// Export pour utilisation dans les composants
export { MTN_USSD_CODES, resolveContactByName };
export type { USSDCodeType, USSDParams };
