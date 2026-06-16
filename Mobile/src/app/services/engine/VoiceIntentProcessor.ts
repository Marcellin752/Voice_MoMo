import { ContactResolverService } from './ContactResolverService';
import { MoMoTransactionEngine } from '../ussd_engine/MoMoTransactionEngine';
import { InterNetworkTransferEngine } from '../ussd_engine/InterNetworkTransferEngine';
import { NetworkDetector, MobileNetwork } from './NetworkDetector';

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
    console.log('🔄 [VIP] processIntent called with intent:', intent, 'data:', nlpResponse);

    if (WALLET_TRANSFER_INTENTS.has(intent)) {
      console.log('🔄 [VIP] Routing to runWalletTransfer');
      const result = await this.runWalletTransfer(nlpResponse, intent);
      console.log('🔄 [VIP] runWalletTransfer returned:', result);
      return result;
    }

    if (intent === 'balance' || intent === 'momo_balance') {
      console.log('🔄 [VIP] Routing to checkBalance');
      const result = await this.transactionEngine.checkBalance();
      console.log('🔄 [VIP] checkBalance returned:', result);
      return result;
    }

    console.log('🔄 [VIP] Intent unsupported:', intent);
    return { status: 'unsupported', message: `Intention non supportée: ${intent || '?'}.` };
  }

  /** Transfert ou dépôt vers un tiers : même chaîne USSD courte MTN Bénin (*880*1*1*…). */
  private async runWalletTransfer(nlpResponse: any, intent: string) {
    const amount = nlpResponse.amount;
    const recipientRaw = nlpResponse.recipient;
    console.log('🔄 [VIP] runWalletTransfer:', { amount, recipientRaw, intent });

    // BUG #6 FIX: Ajouter montant minimum/maximum
    const MIN_TRANSFER_AMOUNT = 100;  // XOF
    const MAX_TRANSFER_AMOUNT = 500000;  // XOF

    if (amount == null || Number(amount) < MIN_TRANSFER_AMOUNT || Number(amount) > MAX_TRANSFER_AMOUNT) {
      // UX Fix: Message humain avec francs CFA
      console.log('🔄 [VIP] Amount validation failed:', { amount, MIN: MIN_TRANSFER_AMOUNT, MAX: MAX_TRANSFER_AMOUNT });
      return {
        status: 'error',
        message: `Le montant doit être entre ${MIN_TRANSFER_AMOUNT.toLocaleString('fr-FR')} et ${MAX_TRANSFER_AMOUNT.toLocaleString('fr-FR')} francs CFA. Quel montant souhaitez-vous envoyer ?`
      };
    }
    if (!recipientRaw || String(recipientRaw).trim() === '') {
      console.log('🔄 [VIP] Recipient missing');
      return { status: 'error', message: 'Destinataire manquant (nom ou numéro).' };
    }

    console.log('🔄 [VIP] Resolving recipient:', recipientRaw);
    const contacts = await this.contactResolver.resolve(recipientRaw);
    console.log('🔄 [VIP] Contacts resolved:', contacts?.length || 0, 'matches');

    if (!contacts || contacts.length === 0) {
      // UX Fix #5: Proposer une alternative au lieu de bloquer
      console.log('🔄 [VIP] No contacts found for:', recipientRaw);
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

    console.log('🔄 [VIP] Contact match decision:', {
      top: `${top.name} (${top.confidence})`,
      runnerUp: `${contacts[1]?.name || 'none'} (${runnerUpConfidence})`,
      isClearWinner,
      thresholds: { auto_accept: ContactResolverService.AUTO_ACCEPT_THRESHOLD, gap: ContactResolverService.CLEAR_WINNER_GAP }
    });

    if (!isClearWinner) {
      console.log('🔄 [VIP] Returning ambiguity - showing contact list');
      return {
        status: 'ambiguity',
        ambiguity: contacts.slice(0, 5),
        // UX: formulation qui assume une transcription imparfaite
        message: `Je ne suis pas sûr d'avoir bien compris "${recipientRaw}". Est-ce l'un de ces contacts ?`,
      };
    }

    console.log('🔄 [VIP] Clear winner - proceeding with auto-execute');

    const finalNumber = top.phone;
    console.log('🔄 [VIP] Final number resolved:', finalNumber);

    // 🆕 FEATURE: Détection inter-réseau
    try {
      // Récupérer le numéro de l'utilisateur (supposé DÉJÀ validé/formaté au login)
      const userPhone = localStorage.getItem('momo.user.phone');

      if (!userPhone) {
        console.error('❌ [VIP] User phone not found in localStorage');
        return {
          status: 'error',
          message: 'Numéro utilisateur non configuré. Veuillez vous reconnecter.'
        };
      }

      console.log('🔄 [VIP] Initializing inter-network engine');
      const interNetworkEngine = new InterNetworkTransferEngine(userPhone, finalNumber);

      // Vérifier que le transfert est possible (seul MTN peut initier pour l'instant)
      const canExecute = interNetworkEngine.canExecuteTransfer();
      if (!canExecute.canExecute) {
        console.log('🔄 [VIP] Transfer not allowed:', canExecute.reason);
        return {
          status: 'error',
          message: canExecute.reason || 'Transfert non autorisé'
        };
      }

      // Récupérer les infos du transfert
      const transferInfo = interNetworkEngine.getTransferInfo();
      const recipientNetwork = NetworkDetector.detectNetwork(finalNumber);

      console.log(`🔄 [VIP] Transfer prepared - ${NetworkDetector.getNetworkLabel(transferInfo.senderNetwork)} → ${NetworkDetector.getNetworkLabel(recipientNetwork)} via ${transferInfo.service}`);

      // Exécution directe du transfert (sans demander le PIN en interne)
      return {
        status: 'execute',
        intent: intent,
        data: {
          phone: finalNumber,
          amount: Number(amount),
          recipientName: contacts[0].name,
          senderNetwork: transferInfo.senderNetwork,
          recipientNetwork: recipientNetwork,
          service: transferInfo.service
        }
      };
    } catch (error) {
      console.error('❌ [VIP] Erreur inter-réseau:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors du transfert inter-réseau'
      };
    }
  }
}
