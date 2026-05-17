import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { ContactResolverService } from '../engine/ContactResolverService';
import type { AccessibilityPluginInterface } from './AccessibilityPlugin.types';
import type { UssdBackgroundPlugin } from './UssdBackgroundPlugin.types';

function formatUssdFailureMessage(e: unknown, e2: unknown): string {
    const parts = [e, e2].map((x) => (x instanceof Error ? x.message : String(x)));
    const joined = parts.filter(Boolean).join(' | ');
    const m = /USSD_(-?\d+):(.+)/.exec(joined);
    if (m) {
        return `Échec USSD (${m[1]}): ${m[2].trim()}. Si vous avez deux cartes SIM, vérifiez que les données MoMo sont sur la bonne puce.`;
    }
    if (joined.includes('Permission') || joined.includes('permission')) {
        return 'Permission téléphone refusée. Autorisez « Téléphone » et « État du téléphone » pour Voice MoMo.';
    }
    return "Impossible d'envoyer le code USSD. Réessayez ou ouvrez le menu *880# manuellement.";
}

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

        const phone = contacts[0].phone;
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
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        const resolver = new ContactResolverService();
        const formattedRecipient = resolver.formatBeninNumber(data.recipient);
        // Format corrigé : *880*1*1*Numéro*Numéro*Montant#
        const ussdCode = `*880*1*1*${formattedRecipient}*${formattedRecipient}*${data.amount}#`;

        try {
            console.log('⚙️ [ENGINE] [FINAL_CODE] Ready:', ussdCode);

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

            console.log('⚙️ [ENGINE] [DEBUG] Executing silent USSD in background:', ussdCode);
            const response = await UssdBackground.executeUssd({ code: ussdCode });
            console.log('✅ [ENGINE] Silent transfer initiated:', response);

            if (response && response.status === 'success' && response.isFinal) {
                this.updateState(TransactionState.SUCCESS, { message: response.message });
                this.cleanup();
            }

            return { status: 'success', message: 'Opération lancée silencieusement...', dialerFallback: false };
        } catch (e: any) {
            console.error('⚙️ [ENGINE] [ERROR] Silent USSD failed:', e);
            const errorDetail = e.message || String(e);

            if (errorDetail.includes('Permission') || errorDetail.includes('permission')) {
                const msg = 'Permission téléphone manquante. Allez dans les paramètres pour autoriser Voice MoMo.';
                this.updateState(TransactionState.FAILED, { error: msg });
                return { status: 'error', message: msg };
            }

            // Fallback d'Accessibilité si le silence complet bloque ou n'est pas supporté
            try {
                console.log('⚙️ [ENGINE] [FALLBACK] Attempting AccessibilityPlugin...');
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
                return { status: 'success', message: 'USSD lancé via Accessibilité.' };
            } catch (e2: any) {
                console.error('⚙️ [ENGINE] [ERROR] AccessibilityPlugin failed:', e2);

                // Si tout le reste échoue, on tente l'appel direct traditionnel en dernier ressort
                const msg = 'Impossible d’exécuter en arrière-plan. Tentative d’appel direct...';
                console.warn(msg);

                try {
                    console.log('⚙️ [ENGINE] [FALLBACK] Launching ACTION_CALL...');
                    await UssdBackground.executeDirectCall({ code: ussdCode });
                    this.updateState(TransactionState.TRIGGERING_DIALER);
                    return { status: 'success', message: 'Appel direct lancé. Suivez les instructions système.', dialerFallback: true };
                } catch (e3: any) {
                    const finalError = e3.message || String(e3);
                    console.error('⚙️ [ENGINE] [CRITICAL] All fallbacks failed:', finalError);
                    this.updateState(TransactionState.FAILED, { error: `Échec total: ${finalError}` });
                    return { status: 'error', message: `Erreur USSD: ${finalError}` };
                }
            }
        }
    }

    async confirmWithPin(pin: string, payload: { phone: string, amount: number }) {
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        const resolver = new ContactResolverService();
        const formattedPhone = resolver.formatBeninNumber(payload.phone);
        // Format corrigé avec PIN : *880*1*1*Numéro*Numéro*Montant*PIN#
        const ussdCode = `*880*1*1*${formattedPhone}*${formattedPhone}*${payload.amount}*${pin}#`;

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

            console.log('⚙️ [ENGINE] [CONFIRM] Executing silent USSD with PIN in background:', ussdCode.replace(pin, '****'));

            const response = await UssdBackground.executeUssd({ code: ussdCode });
            console.log('✅ [ENGINE] Silent PIN execution response:', response);
            
            if (response && response.status === 'success' && response.isFinal) {
                this.updateState(TransactionState.SUCCESS, { message: response.message });
                this.cleanup();
            }
        } catch (e: any) {
            console.error('⚙️ [ENGINE] Error in confirmWithPin (Background):', e);
            try {
                console.log('⚙️ [ENGINE] [FALLBACK] Attempting Accessibility for PIN flow...');
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
            } catch (e2: any) {
                console.error('⚙️ [ENGINE] [ERROR] All silent PIN flows failed:', e2);
                
                try {
                    await UssdBackground.executeDirectCall({ code: ussdCode });
                    this.updateState(TransactionState.TRIGGERING_DIALER);
                } catch (e3: any) {
                    const finalErr = e3.message || String(e3);
                    this.updateState(TransactionState.FAILED, { error: `Erreur PIN: ${finalErr}` });
                    this.cleanup();
                }
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
