import { Capacitor } from '@capacitor/core';

export class ContactResolverService {
  async resolve(nameQuery: string): Promise<any> {
    if (!nameQuery) return null;
    
    // Si c'est déjà un numéro
    const digitsOnly = nameQuery.replace(/\D/g, '');
    if (digitsOnly.length >= 8) {
      return [{ name: "Numéro saisi", phone: digitsOnly }];
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
             let phone = contact.phones?.[0]?.number || '';
             phone = phone.replace(/[\s.()-]/g, '');
             if (phone.startsWith('+229')) phone = phone.substring(4);
             else if (phone.startsWith('00229')) phone = phone.substring(5);
             if (phone) matches.push({ name: contact.displayName, phone });
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
