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

  /**
   * Vérifie formellement si le numéro de téléphone appartient au réseau MTN Bénin
   * en se basant sur les préfixes du plan de numérotation.
   */
  public isMtnBeninNumber(phone: string): boolean {
    const formatted = this.formatBeninNumber(phone);
    if (formatted.length !== 10 || !formatted.startsWith('01')) return false;

    const prefix = formatted.substring(2, 4);

    // Préfixes connus de Moov et Celtis pour exclusion
    const moovPrefixes = ['95', '94', '60', '64', '65', '55', '58'];
    const celtisPrefixes = ['40', '41', '42', '43', '44'];

    if (moovPrefixes.includes(prefix) || celtisPrefixes.includes(prefix)) {
      return false;
    }
    return true;
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
        const matches: { name: string; phone: string }[] = [];
        const search = nameQuery.toLowerCase().trim();

        for (const contact of result.contacts) {
          const dName = (contact.displayName || (contact as any).name?.display || '').toLowerCase();
          if (dName.includes(search)) {
            const phones = contact.phones ?? [];
            if (phones.length === 0) continue;

            // Créer une entrée par numéro de téléphone pour permettre la désambiguïsation
            for (const phoneEntry of phones) {
              const rawPhone = phoneEntry.number || '';
              if (!rawPhone) continue;
              const formattedPhone = this.formatBeninNumber(rawPhone);
              matches.push({
                name: contact.displayName || dName,
                phone: formattedPhone,
              });
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
