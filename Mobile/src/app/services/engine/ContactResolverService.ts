import { Capacitor } from '@capacitor/core';

export class ContactResolverService {
  /**
   * Similarité minimale pour PROPOSER un contact comme candidat. Volontairement
   * basse : si l'IA a mal transcrit le nom dicté, le bon contact doit quand même
   * remonter dans la liste de suggestions plutôt que disparaître ("introuvable").
   */
  static readonly CANDIDATE_THRESHOLD = 0.4;
  /**
   * Au-dessus de ce score, un contact est assez sûr pour être exécuté
   * directement (sans demander de confirmer) — à condition d'être nettement
   * devant le 2e candidat (cf. CLEAR_WINNER_GAP).
   */
  static readonly AUTO_ACCEPT_THRESHOLD = 0.85;
  /** Écart de confiance minimal avec le 2e candidat pour trancher sans demander. */
  static readonly CLEAR_WINNER_GAP = 0.15;

  /**
   * Normalise un numéro pour le plan de numérotation du Bénin (10 chiffres).
   * Ajoute '01' si le numéro est à 8 chiffres ou si l'indicatif +229 est présent sans le 01.
   */
  public formatBeninNumber(phone: string): string {
    // 1. Nettoyage complet : ne garder que les chiffres
    const digits = phone.replace(/\D/g, '');
    console.log(`[FORMAT] Raw digits from "${phone}": ${digits}`);

    // 2. Si le numéro commence par 229 (indicatif Bénin), le retirer
    let cleaned = digits;
    if (cleaned.startsWith('229')) {
      console.log(`[FORMAT] Removing Benin country code 229 from: ${cleaned}`);
      cleaned = cleaned.substring(3);
    }

    // 3. Extraire la base de 8 chiffres (les 8 derniers chiffres du numéro)
    if (cleaned.length < 8) {
      console.error(`[FORMAT] Number too short (${cleaned.length} digits): ${cleaned}`);
      // UX Fix #2: Message humain avec exemple
      throw new Error(`Le numéro que j'ai compris est incomplet (${cleaned}). Pouvez-vous répéter le numéro complet, par exemple 9-5-1-2-3-4-5-6 ?`);
    }

    const base8 = cleaned.slice(-8);
    const formatted = '01' + base8;
    console.log(`[FORMAT] Result: ${formatted}`);

    return formatted;
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

  /**
   * Nettoye une chaîne pour la comparaison (minuscules, sans accents)
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  /**
   * Calcule la distance de Levenshtein entre deux chaînes
   */
  private levenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1 // deletion
            )
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Calcule un score de similarité entre 0 et 1
   */
  private getSimilarityScore(a: string, b: string): number {
    const distance = this.levenshtein(a, b);
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    return 1 - distance / maxLength;
  }

  async resolve(nameQuery: string): Promise<any> {
    if (!nameQuery) return null;

    // Si c'est déjà un numéro
    const digitsOnly = nameQuery.replace(/\D/g, '');
    if (digitsOnly.length >= 8) {
      const formatted = this.formatBeninNumber(digitsOnly);
      return [{ name: "Numéro saisi", phone: formatted, confidence: 1.0 }];
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const { Contacts } = await import('@capacitor-community/contacts');
        const permission = await Contacts.requestPermissions();

        if (permission.contacts !== 'granted') return null;

        const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
        const matches: { name: string; phone: string; confidence: number }[] = [];
        const searchNormalized = this.normalizeString(nameQuery);

        for (const contact of result.contacts) {
          const rawName = (contact as any).displayName || (contact as any).name?.display || '';
          const nameNormalized = this.normalizeString(rawName);

          if (!nameNormalized) continue;

          // Score base sur string contains
          let confidence = 0.0;
          if (nameNormalized.includes(searchNormalized)) {
            // Correspondance directe (exacte ou partielle)
            confidence = (searchNormalized.length === nameNormalized.length) ? 1.0 : 0.8;
          } else {
            // Correspondance floue (Levenshtein) - recherche par proximité lexicale (pour homonymes/fautes)
            confidence = this.getSimilarityScore(searchNormalized, nameNormalized);

            // Si le nom du contact contient plusieurs mots (ex: prénom nom), testons les mots séparés aussi
            const words = nameNormalized.split(/\s+/);
            for (const word of words) {
              const wordScore = this.getSimilarityScore(searchNormalized, word);
              if (wordScore > confidence) {
                // Pénalité légère pour le match sur un seul mot d'un nom composé
                confidence = wordScore * 0.95;
              }
            }
          }

          // Seuil bas : on garde tout candidat « proche » pour pouvoir le proposer
          // en cas de transcription imparfaite (la décision auto/suggestion se
          // fait plus haut, dans VoiceIntentProcessor).
          if (confidence >= ContactResolverService.CANDIDATE_THRESHOLD) {
            const phones = contact.phones ?? [];
            if (phones.length === 0) continue;

            // Créer une entrée par numéro de téléphone pour permettre la désambiguïsation
            for (const phoneEntry of phones) {
              const rawPhone = phoneEntry.number || '';
              if (!rawPhone) continue;
              const formattedPhone = this.formatBeninNumber(rawPhone);
              // Filtre anti-doublon : éviter d'ajouter le même numéro (ex: avec/sans indicatif)
              const isDuplicate = matches.some(m => m.phone === formattedPhone);
              if (!isDuplicate) {
                matches.push({
                  name: rawName,
                  phone: formattedPhone,
                  confidence: parseFloat(confidence.toFixed(2))
                });
              }
            }
          }
        }

        // Trier les résultats par indice de confiance décroissant
        matches.sort((a, b) => b.confidence - a.confidence);

        return matches.length > 0 ? matches : null;
      } catch (e) {
        console.error("Erreur ContactResolver", e);
        return null;
      }
    }
    return null;
  }

}
