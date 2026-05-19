import { ContactResolverService } from './ContactResolverService';
import { MoMoTransactionEngine } from '../ussd_engine/MoMoTransactionEngine';

/** Intents qui envoient un USSD *880*… vers un numéro (transfert / dépôt wallet-to-wallet). */
const WALLET_TRANSFER_INTENTS = new Set([
  'transfer',
  'momo_send',
  'deposit',
  'momo_deposit',
]);

export class VoiceIntentProcessor {
  private contactResolver = new ContactResolverService();
  private transactionEngine = new MoMoTransactionEngine();

  async processIntent(nlpResponse: any) {
    const intent = String(nlpResponse?.intent || '').toLowerCase();

    if (WALLET_TRANSFER_INTENTS.has(intent)) {
      return await this.runWalletTransfer(nlpResponse);
    }

    if (intent === 'balance' || intent === 'momo_balance') {
      return await this.transactionEngine.checkBalance();
    }

    return { status: 'unsupported', message: `Intention non supportée: ${intent || '?'}.` };
  }

  /** Transfert ou dépôt vers un tiers : même chaîne USSD courte MTN Bénin (*880*1*1*…). */
  private async runWalletTransfer(nlpResponse: any) {
    const amount = nlpResponse.amount;
    const recipientRaw = nlpResponse.recipient;

    if (amount == null || Number(amount) <= 0) {
      return { status: 'error', message: 'Montant manquant ou invalide.' };
    }
    if (!recipientRaw || String(recipientRaw).trim() === '') {
      return { status: 'error', message: 'Destinataire manquant (nom ou numéro).' };
    }

    const contacts = await this.contactResolver.resolve(recipientRaw);

    if (!contacts || contacts.length === 0) {
      return { status: 'error', message: `Le contact '${recipientRaw}' est introuvable.` };
    }

    // S'il y a plusieurs contacts avec des confiances similaires, demander à l'utilisateur de choisir
    // (même si le premier a confiance 1.0, s'il y en a plusieurs c'est ambigu)
    if (contacts.length > 1) {
      // Vérifier si les top contacts ont des confiances proches (écart < 0.15)
      const topConfidence = contacts[0].confidence;
      const similarContacts = contacts.filter((c: { confidence: number }) => topConfidence - c.confidence < 0.15);
      
      if (similarContacts.length > 1) {
        return { status: 'ambiguity', ambiguity: similarContacts.slice(0, 5), message: `Plusieurs contacts trouvés pour '${recipientRaw}'.` };
      }
    }

    const finalNumber = contacts[0].phone;

    // Vérification réseau MTN
    if (!this.contactResolver.isMtnBeninNumber(finalNumber)) {
      return { status: 'error', message: `Le numéro ${finalNumber} n'est pas un compte MTN Bénin valide.` };
    }

    // Demander le PIN via l'UI au lieu d'exécuter directement
    return { 
      status: 'awaiting_pin',
      promptPin: true, 
      context: { 
        phone: finalNumber, 
        amount: Number(amount),
        recipientName: contacts[0].name 
      } 
    };
  }
}
