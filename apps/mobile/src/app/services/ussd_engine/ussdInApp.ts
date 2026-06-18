import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AccessibilityPluginInterface } from './AccessibilityPlugin.types';
import type { UssdBackgroundPlugin } from './UssdBackgroundPlugin.types';

const UssdBackground = registerPlugin<UssdBackgroundPlugin>('UssdBackground');
const AccessibilityPlugin = registerPlugin<AccessibilityPluginInterface>('AccessibilityPlugin');

/**
 * Exécute un code USSD via l’API Telephony (sans ouvrir le composeur).
 * Ordre : UssdBackground → AccessibilityPlugin (même API côté natif).
 */
export async function executeUssdCodeInApp(ussdCode: string): Promise<{ success: boolean; message: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { success: false, message: "L'exécution USSD n'est disponible que sur l'application Android." };
  }

  try {
    await UssdBackground.executeUssd({ code: ussdCode });
    return { success: true, message: 'Code USSD envoyé depuis l’application.' };
  } catch (e1) {
    console.warn('[USSD] UssdBackground a échoué, tentative via AccessibilityPlugin…', e1);
    try {
      await AccessibilityPlugin.executeUssd({ code: ussdCode });
      return { success: true, message: 'Code USSD envoyé depuis l’application.' };
    } catch (e2) {
      console.error('[USSD] Échec exécution in-app:', e2);
      return {
        success: false,
        message:
          "Impossible d'exécuter le code USSD dans l'application. Vérifiez les permissions téléphone (appels + état du téléphone) et réessayez.",
      };
    }
  }
}
