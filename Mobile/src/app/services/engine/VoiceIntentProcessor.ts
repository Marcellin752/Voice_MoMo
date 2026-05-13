import { ContactResolverService } from './ContactResolverService';
import { MoMoTransactionEngine } from '../ussd_engine/MoMoTransactionEngine';

export class VoiceIntentProcessor {
  private contactResolver = new ContactResolverService();
  private transactionEngine = new MoMoTransactionEngine();

  async processIntent(nlpResponse: any) {
    if (nlpResponse.intent === 'transfer') {
      const contacts = await this.contactResolver.resolve(nlpResponse.recipient);
      
      if (!contacts || contacts.length === 0) {
        return { status: 'error', message: `Le contact '${nlpResponse.recipient}' est introuvable.` };
      }

      if (contacts.length > 1) {
        return { status: 'ambiguity', contacts, message: `Plusieurs contacts trouvés pour '${nlpResponse.recipient}'.` };
      }

      const finalNumber = contacts[0].phone;
      
      return await this.transactionEngine.startTransfer({
        amount: nlpResponse.amount,
        recipient: finalNumber
      });
    }

    if (nlpResponse.intent === 'balance') {
      return await this.transactionEngine.checkBalance();
    }

    return { status: 'unsupported', message: "Intention non supportée." };
  }
}
