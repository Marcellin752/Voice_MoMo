import { Capacitor } from '@capacitor/core';

export class ContactResolverService {
  /**
   * Normalise un numéro pour le plan de numérotation du Bénin (10 chiffres).
   * Ajoute '01' si le numéro est à 8 chiffres ou si l'indicatif +229 est présent sans le 01.
   */
  public formatBeninNumber(phone: string): string {
    let cleaned = phone.replace(/[\s.()-]/g, '');
    
    // Supprimer l'indicatif international pour travailler sur la base
    if (cleaned.startsWith('+229')) cleaned = cleaned.substring(4);
    else if (cleaned.startsWith('229')) cleaned = cleaned.substring(3);
    else if (cleaned.startsWith('00229')) cleaned = cleaned.substring(5);

    // Si le numéro commence par 01 et fait 10 chiffres, il est déjà correct
    if (cleaned.length === 10 && cleaned.startsWith('01')) {
      return cleaned;
    }

    // Si le numéro fait 8 chiffres (ancien format), on ajoute 01
    if (cleaned.length === 8) {
      return '01' + cleaned;
    }

    // Si le numéro fait 9 chiffres et commence par 0, c'est peut-être une saisie hybride
    if (cleaned.length === 9 && cleaned.startsWith('0')) {
      return '01' + cleaned.substring(1);
    }

    return cleaned;
  }

  async resolve(nameQuery: string): Promise<any> {
    if (!nameQuery) return null;
    
    // Si c'est déjà un numéro
    const digitsOnly = nameQuery.replace(/\D/g, '');
    if (digitsOnly.length >= 8) {
      const formatted = this.formatBeninNumber(digitsOnly);
      return [{ name: "Numéro saisi", phone: formatted }];
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const { Contacts } = await import('@capacitor-community/contacts');
        const permission = await Contacts.requestPermissions();
        
        if (permission.contacts !== 'granted') return null;

        const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
        const matches = [];
        const search = nameQuery.toLowerCase().trim();

        for (const contact of result.contacts) {
          const dName = (contact.displayName || (contact as any).name?.display || "").toLowerCase();
          if (dName.includes(search)) {
             let rawPhone = contact.phones?.[0]?.number || '';
             if (rawPhone) {
                const formattedPhone = this.formatBeninNumber(rawPhone);
                matches.push({ name: contact.displayName, phone: formattedPhone });
             }
          }
        }
        return matches.length > 0 ? matches : null;
      } catch (e) {
        console.error("Erreur ContactResolver", e);
        return null;
      }
    }
    return null;
  }
}
