import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { ContactResolverService } from '../engine/ContactResolverService';
import type { AccessibilityPluginInterface } from './AccessibilityPlugin.types';
import type { UssdBackgroundPlugin } from './UssdBackgroundPlugin.types';

const AccessibilityPlugin = registerPlugin<AccessibilityPluginInterface>('AccessibilityPlugin');
const UssdBackground = registerPlugin<UssdBackgroundPlugin>('UssdBackground');

export enum TransactionState {
    INIT,
    WAITING_ACCESSIBILITY_PERMISSION,
    RESOLVING_CONTACT,
    TRIGGERING_DIALER,
    AWAITING_PIN_UI,
    USSD_IN_PROGRESS,
    SUCCESS,
    FAILED
}

export class MoMoTransactionEngine {
    state = TransactionState.INIT;
    private autoListener: PluginListenerHandle | null = null;
    private ussdListener: PluginListenerHandle | null = null;
    private onStateChange: ((state: TransactionState, payload?: any) => void) | null = null;

    setStateListener(callback: (state: TransactionState, payload?: any) => void) {
        this.onStateChange = callback;
    }

    private updateState(newState: TransactionState, payload?: any) {
        this.state = newState;
        if (this.onStateChange) this.onStateChange(newState, payload);
    }

    async initiateVoiceTransfer(nlpIntent: any) {
        // 1. Accessibility Check (pour compatibilité, mais on va utiliser UssdBackground d'abord)
        this.updateState(TransactionState.RESOLVING_CONTACT);
        console.log('⚙️ [ENGINE] [DEBUG] Resolving contact for:', nlpIntent.recipient);
        const resolver = new ContactResolverService();
        const contacts = await resolver.resolve(nlpIntent.recipient);

        if (!contacts || contacts.length === 0) {
            this.updateState(TransactionState.FAILED, { error: `Contact introuvable: ${nlpIntent.recipient}` });
            return { error: "Contact introuvable." };
        }
        if (contacts.length > 1 && contacts[0].confidence < 1.0) {
            return { ambiguity: contacts.slice(0, 3) };
        }

        const phone = contacts[0].phoneNumber;
        const amount = nlpIntent.amount;

        // 2. Request PIN from Internal UI
        this.updateState(TransactionState.AWAITING_PIN_UI);
        console.log('⚙️ [ENGINE] [DEBUG] Awaiting PIN from UI');
        return { promptPin: true, context: { phone, amount } };
    }

    async checkBalance() {
        console.log('⚙️ [ENGINE] [START] checkBalance (from SMS)');
        this.updateState(TransactionState.USSD_IN_PROGRESS);
        
        try {
            const { SmsListenerService } = await import('../sms.service');
            const balance = await SmsListenerService.readBalanceFromSmsHistory();
            
            if (balance !== null) {
                console.log('✅ [ENGINE] [SUCCESS] Balance found:', balance);
                this.updateState(TransactionState.SUCCESS, { balance });
                
                try {
                    const { updateBalance } = await import('../users.service');
                    await updateBalance(balance);
                } catch (e) {
                    console.warn('⚠️ [ENGINE] Could not save balance to backend:', e);
                }
                
                return { status: 'success', balance };
            } else {
                console.log('⚠️ [ENGINE] No balance found in SMS history');
                this.updateState(TransactionState.FAILED, { error: 'Aucun solde trouvé dans les messages' });
                return { status: 'error', message: 'Aucun solde trouvé dans les messages SMS' };
            }
        } catch (e) {
            console.error('⚙️ [ENGINE] [ERROR] Failed to read balance from SMS:', e);
            this.updateState(TransactionState.FAILED, { error: String(e) });
            return { status: 'error', message: 'Échec lecture solde depuis SMS' };
        }
    }

    async startTransfer(data: { amount: number, recipient: string }) {
        console.log('⚙️ [ENGINE] [START] startTransfer:', data);
        const ussdCode = `*880*1*1*${data.recipient}*${data.amount}#`;
        console.log('⚙️ [ENGINE] [DEBUG] USSD code:', ussdCode);
        
        try {
            this.updateState(TransactionState.USSD_IN_PROGRESS);
            
            this.ussdListener = await UssdBackground.addListener('ussdEvent', (event) => {
                console.log('📡 [ENGINE] USSD Event:', event);
                if (event.isFinal) {
                    if (event.type === 'response') {
                        this.updateState(TransactionState.SUCCESS, { message: event.message });
                    } else {
                        this.updateState(TransactionState.FAILED, { error: event.message });
                    }
                    this.cleanup();
                }
            });

            const response = await UssdBackground.executeUssd({ code: ussdCode });
            console.log('⚙️ [ENGINE] [SUCCESS] USSD Executed in background:', response);
            return { status: 'success', message: 'USSD Lancé en arrière-plan' };
        } catch (e) {
            console.error('⚙️ [ENGINE] [ERROR] Failed to execute USSD in background:', e);
            try {
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
                return { status: 'success', message: 'USSD lancé depuis l’application (canal secondaire).' };
            } catch (e2) {
                console.error('⚙️ [ENGINE] [ERROR] Fallback accessibility failed:', e2);
                const msg =
                    "Impossible d'exécuter le code USSD dans l'application. Vérifiez les permissions téléphone (appels, état du téléphone).";
                this.updateState(TransactionState.FAILED, { error: msg });
                return { status: 'error', message: msg };
            }
        }
    }

    async confirmWithPin(pin: string, payload: {phone: string, amount: number}) {
        this.updateState(TransactionState.USSD_IN_PROGRESS);
        
        try {
            this.ussdListener = await UssdBackground.addListener('ussdEvent', (event) => {
                console.log('📡 [ENGINE] USSD Event:', event);
                if (event.isFinal) {
                    if (event.type === 'response') {
                        this.updateState(TransactionState.SUCCESS, { message: event.message });
                    } else {
                        this.updateState(TransactionState.FAILED, { error: event.message });
                    }
                    this.cleanup();
                }
            });

            // Note: Pour les transactions nécessitant un PIN, le flux USSD en plusieurs étapes
            // nécessiterait une gestion plus avancée. Pour l'instant, on tente le code direct.
            const ussdCode = `*880*1*1*${payload.phone}*${payload.amount}#`;
            const response = await UssdBackground.executeUssd({ code: ussdCode });
            console.log('✅ [ENGINE] Transfer initiated with response:', response);
        } catch (e) {
            console.error('⚙️ [ENGINE] Error in confirmWithPin:', e);
            try {
                const ussdCode = `*880*1*1*${payload.phone}*${payload.amount}#`;
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
            } catch (e2) {
                this.updateState(TransactionState.FAILED, { error: String(e2) });
                this.cleanup();
            }
        }
    }

    private handleAutoEvent(event: any) {
        console.log("Accessibility USSD Event: ", event);
        if (event.status === 'success') {
            this.updateState(TransactionState.SUCCESS, { message: event.message });
            this.cleanup();
        } else if (event.status === 'error') {
            this.updateState(TransactionState.FAILED, { error: event.message });
            this.cleanup();
        } else if (event.status === 'awaiting_pin') {
            this.updateState(TransactionState.FAILED, { error: "Problème PIN côté réseau" });
            this.cleanup();
        }
    }

    private cleanup() {
        if (this.autoListener) {
            this.autoListener.remove();
            this.autoListener = null;
        }
        if (this.ussdListener) {
            this.ussdListener.remove();
            this.ussdListener = null;
        }
        AccessibilityPlugin.setTransactionActive({ active: false });
        this.updateState(TransactionState.INIT);
    }
}
