import { ContactResolverService } from './ContactResolverService';
import { MoMoTransactionEngine } from '../ussd_engine/MoMoTransactionEngine';
import { InterNetworkTransferEngine } from '../ussd_engine/InterNetworkTransferEngine';
import { NetworkDetector, MobileNetwork } from './NetworkDetector';
import { StorageService } from '../storage.service';
import type { ApiUser } from '../../utils/api';

/** Intents qui envoient un USSD *880*… vers un numéro (transfert / dépôt wallet-to-wallet). */
const WALLET_TRANSFER_INTENTS = new Set([
  'transfer',
  'momo_send',
  'deposit',
  'momo_deposit',
]);

const SIMPLE_USSD_INTENTS: Record<string, { code: string; message: string }> = {
  withdraw: {
    code: '*880*2#',
    message: 'Menu retrait MoMo ouvert. Suivez les instructions à l\'écran, puis validez avec votre code PIN.',
  },
  withdraw_gab: {
    code: '*880*724#',
    message: 'Génération du code retrait GAB. Suivez les instructions MTN à l\'écran.',
  },
  bill_payment: {
    code: '*880*5#',
    message: 'Menu paiement marchand ouvert. Suivez les instructions à l\'écran.',
  },
};

const MENU_USSD_INTENTS = new Set([
  'recharge',
  'internet_day',
  'internet_week',
  'internet_month',
  'internet_unlimited',
  'gopack_day',
  'gopack_week',
  'gopack_month',
]);

const HELP_MESSAGE =
  'Je peux envoyer de l\'argent, consulter votre solde, retirer, recharger du crédit ou payer une facture. ' +
  'Exemples : « Envoie 5000 à Jean », « Quel est mon solde ? », « Achète 2000 francs de crédit », « Annule ».';

export class VoiceIntentProcessor {
  private contactResolver = new ContactResolverService();
  private transactionEngine = new MoMoTransactionEngine();

  async processIntent(nlpResponse: any) {
    const intent = String(nlpResponse?.intent || '').toLowerCase();
    console.log('🔄 [VIP] processIntent called with intent:', intent, 'data:', nlpResponse);

    if (intent === 'help') {
      return { status: 'success', message: HELP_MESSAGE };
    }

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

    const simple = SIMPLE_USSD_INTENTS[intent];
    if (simple) {
      return this.runSimpleUssd(simple.code, simple.message);
    }

    if (MENU_USSD_INTENTS.has(intent)) {
      const amount = nlpResponse.amount;
      if (amount != null && Number(amount) > 0) {
        return this.runSimpleUssd(
          '*880#',
          `Menu MoMo ouvert pour votre demande de ${Number(amount).toLocaleString('fr-FR')} francs. Suivez les instructions à l'écran.`
        );
      }
      return this.runSimpleUssd(
        '*880#',
        'Menu MoMo ouvert. Choisissez l\'option crédit ou forfait à l\'écran, puis validez avec votre PIN.'
      );
    }

    console.log('🔄 [VIP] Intent unsupported:', intent);
    return { status: 'unsupported', message: `Je n'ai pas encore appris à faire « ${intent || '?'} » par la voix. Dites « aide » pour la liste des commandes.` };
  }

  private async runSimpleUssd(code: string, message: string) {
    const res = await this.transactionEngine.launchSimpleUssd(code, message);
    if (res.status === 'error') {
      return { status: 'error', message: res.message };
    }
    return {
      status: res.status === 'initiated' ? 'success' : res.status,
      message: res.message,
      dialerFallback: res.dialerFallback,
    };
  }

  /** Transfert ou dépôt vers un tiers : même chaîne USSD courte MTN Bénin (*880*1*1*…). */
  private async runWalletTransfer(nlpResponse: any, intent: string) {
    const amount = nlpResponse.amount;
    const recipientRaw = nlpResponse.recipient;
    console.log('🔄 [VIP] runWalletTransfer:', { amount, recipientRaw, intent });

    const MIN_TRANSFER_AMOUNT = 100;
    const MAX_TRANSFER_AMOUNT = 500000;

    if (amount == null || Number(amount) < MIN_TRANSFER_AMOUNT || Number(amount) > MAX_TRANSFER_AMOUNT) {
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
      console.log('🔄 [VIP] No contacts found for:', recipientRaw);
      return {
        status: 'error',
        message: `Je n'ai pas trouvé "${recipientRaw}" dans vos contacts. Voulez-vous dicter le numéro directement ? Par exemple: envoie 5000 au 95 12 34 56.`
      };
    }

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
        message: `Je ne suis pas sûr d'avoir bien compris "${recipientRaw}". Est-ce l'un de ces contacts ?`,
      };
    }

    console.log('🔄 [VIP] Clear winner - proceeding with auto-execute');

    const finalNumber = top.phone;
    console.log('🔄 [VIP] Final number resolved:', finalNumber);

    try {
      const authUser = await StorageService.get<ApiUser>('momo.auth.user');
      const userPhone = authUser?.phone;

      if (!userPhone || userPhone.trim() === '') {
        console.error('❌ [VIP] User phone not found in auth storage');
        return {
          status: 'error',
          message: 'Numéro utilisateur non configuré. Veuillez vous reconnecter.'
        };
      }

      console.log('🔄 [VIP] Initializing inter-network engine');
      const interNetworkEngine = new InterNetworkTransferEngine(userPhone, finalNumber);

      const canExecute = interNetworkEngine.canExecuteTransfer();
      if (!canExecute.canExecute) {
        console.log('🔄 [VIP] Transfer not allowed:', canExecute.reason);
        return {
          status: 'error',
          message: canExecute.reason || 'Transfert non autorisé'
        };
      }

      const transferInfo = interNetworkEngine.getTransferInfo();
      const recipientNetwork = NetworkDetector.detectNetwork(finalNumber);

      console.log(`🔄 [VIP] Transfer prepared - ${NetworkDetector.getNetworkLabel(transferInfo.senderNetwork)} → ${NetworkDetector.getNetworkLabel(recipientNetwork)} via ${transferInfo.service}`);

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
