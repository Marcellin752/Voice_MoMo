import { Preferences } from '@capacitor/preferences';

export class StorageService {
  /**
   * Synchronise les clés natives (SharedPreferences) vers le localStorage web au démarrage
   * pour que toutes les lectures synchrones existantes obtiennent immédiatement les bonnes données.
   */
  static async syncToLocalStorage(): Promise<void> {
    const keys = [
      'momo.auth.token',
      'momo.auth.user',
      'momo.profile',
      'momo.language',
      'momo.transactions',
      'momo.pin.updatedAt',
      'momo.theme',
      'momo.contacts'
    ];
    for (const key of keys) {
      try {
        const { value } = await Preferences.get({ key });
        if (value) {
          localStorage.setItem(key, value);
        }
      } catch (err) {
        console.warn(`[STORAGE] Impossible de synchroniser la clé native "${key}" vers localStorage:`, err);
      }
    }
    console.log('🔄 [STORAGE] Synchronisation native -> localStorage effectuée avec succès.');
  }

  /**
   * Sauvegarde une valeur de manière permanente sous la clé donnée.
   * L'objet est automatiquement sérialisé s'il ne s'agit pas d'une chaîne.
   */
  static async set(key: string, value: any): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await Preferences.set({ key, value: stringValue });
      
      // Miroir synchrone pour les lectures directes du localStorage
      localStorage.setItem(key, stringValue);
      console.log(`💾 [STORAGE] Sauvegardé sous la clé "${key}"`);
    } catch (err) {
      console.error(`❌ [STORAGE] Erreur d'écriture pour "${key}":`, err);
    }
  }

  /**
   * Récupère une valeur typée sous la clé donnée.
   * Désérialise automatiquement les JSON.
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const { value } = await Preferences.get({ key });
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (err) {
      console.error(`❌ [STORAGE] Erreur de lecture pour "${key}":`, err);
      return null;
    }
  }

  /**
   * Supprime une clé spécifique.
   */
  static async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
      localStorage.removeItem(key); // Miroir synchrone
      console.log(`🧹 [STORAGE] Supprimé la clé "${key}"`);
    } catch (err) {
      console.error(`❌ [STORAGE] Erreur de suppression pour "${key}":`, err);
    }
  }

  /**
   * Efface toutes les données de session et paramètres locaux.
   */
  static async clear(): Promise<void> {
    try {
      await Preferences.clear();
      localStorage.clear(); // Miroir synchrone
      console.log('🧹 [STORAGE] Stockage entièrement vidé.');
    } catch (err) {
      console.error('[STORAGE] Erreur de nettoyage complet:', err);
    }
  }
}
