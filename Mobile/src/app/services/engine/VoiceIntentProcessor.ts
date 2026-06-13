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
      return await this.runWalletTransfer(nlpResponse, intent);
    }

    if (intent === 'balance' || intent === 'momo_balance') {
      return await this.transactionEngine.checkBalance();
    }

    return { status: 'unsupported', message: `Intention non supportée: ${intent || '?'}.` };
  }

  /** Transfert ou dépôt vers un tiers : même chaîne USSD courte MTN Bénin (*880*1*1*…). */
  private async runWalletTransfer(nlpResponse: any, intent: string) {
    const amount = nlpResponse.amount;
    const recipientRaw = nlpResponse.recipient;

    // BUG #6 FIX: Ajouter montant minimum/maximum
    const MIN_TRANSFER_AMOUNT = 100;  // XOF
    const MAX_TRANSFER_AMOUNT = 500000;  // XOF

    if (amount == null || Number(amount) < MIN_TRANSFER_AMOUNT || Number(amount) > MAX_TRANSFER_AMOUNT) {
      // UX Fix: Message humain avec francs CFA
      return { 
        status: 'error', 
        message: `Le montant doit être entre ${MIN_TRANSFER_AMOUNT.toLocaleString('fr-FR')} et ${MAX_TRANSFER_AMOUNT.toLocaleString('fr-FR')} francs CFA. Quel montant souhaitez-vous envoyer ?` 
      };
    }
    if (!recipientRaw || String(recipientRaw).trim() === '') {
      return { status: 'error', message: 'Destinataire manquant (nom ou numéro).' };
    }

    const contacts = await this.contactResolver.resolve(recipientRaw);

    if (!contacts || contacts.length === 0) {
      // UX Fix #5: Proposer une alternative au lieu de bloquer
      return {
        status: 'error',
        message: `Je n'ai pas trouvé "${recipientRaw}" dans vos contacts. Voulez-vous dicter le numéro directement ? Par exemple: envoie 5000 au 95 12 34 56.`
      };
    }

    // Décision : exécuter directement SEULEMENT si le 1er candidat est très sûr ET
    // nettement devant le 2e. Dans tous les autres cas (transcription approximative
    // de l'IA, homonymes, match moyen), on propose la liste des noms les plus proches
    // pour que l'utilisateur choisisse — au lieu d'envoyer au mauvais contact.
    const top = contacts[0];
    const runnerUpConfidence = contacts[1]?.confidence ?? 0;
    const isClearWinner =
      top.confidence >= ContactResolverService.AUTO_ACCEPT_THRESHOLD &&
      (top.confidence - runnerUpConfidence) >= ContactResolverService.CLEAR_WINNER_GAP;

    if (!isClearWinner) {
      return {
        status: 'ambiguity',
        ambiguity: contacts.slice(0, 5),
        // UX: formulation qui assume une transcription imparfaite
        message: `Je ne suis pas sûr d'avoir bien compris "${recipientRaw}". Est-ce l'un de ces contacts ?`,
      };
    }

    const finalNumber = top.phone;

    // Vérification réseau MTN
    if (!this.contactResolver.isMtnBeninNumber(finalNumber)) {
      // UX Fix: Message humain pour numéro non-MTN
      return {
        status: 'error',
        message: `Ce numéro (${finalNumber}) n'est pas un compte MTN MoMo. Voice MoMo ne fonctionne qu'avec les numéros MTN Bénin.`
      };
    }

    // Exécution directe du transfert (sans demander le PIN en interne)
    return {
      status: 'execute',
      intent: intent,
      data: {
        phone: finalNumber,
        amount: Number(amount),
        recipientName: contacts[0].name
      }
    };
  }
}
