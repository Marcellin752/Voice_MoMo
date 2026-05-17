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
    private timeoutId: any = null;
    private onStateChange: ((state: TransactionState, payload?: any) => void) | null = null;

    setStateListener(callback: (state: TransactionState, payload?: any) => void) {
        this.onStateChange = callback;
    }

    private updateState(newState: TransactionState, payload?: any) {
        this.state = newState;
        if (this.onStateChange) this.onStateChange(newState, payload);
    }

    async initiateVoiceTransfer(nlpIntent: any) {
        // Validation Anti-Concurrence
        if (this.state === TransactionState.USSD_IN_PROGRESS) {
            return { error: "Une transaction est déjà en cours." };
        }

        // Validation du montant
        const amount = Number(nlpIntent.amount);
        if (isNaN(amount) || amount <= 0) {
            this.updateState(TransactionState.FAILED, { error: `Montant invalide: ${nlpIntent.amount}` });
            return { error: "Montant invalide." };
        }

        // 1. Accessibility Check (pour compatibilité)
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

        // Vérification de réseau MTN
        if (!resolver.isMtnBeninNumber(phone)) {
            this.updateState(TransactionState.FAILED, { error: `Le numéro ${phone} n'est pas reconnu comme un compte MTN Bénin valide.` });
            return { error: "Destinataire non supporté par MTN." };
        }

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

    private parseUssdEvent(event: any) {
        if (event.isFinal) {
            const msg = event.message || '';
            const isError = /insuffisant|incorrect|échoué|invalide|interdit|non autorisé/i.test(msg);

            if (event.type === 'response' && !isError) {
                this.updateState(TransactionState.SUCCESS, { message: msg });
            } else {
                this.updateState(TransactionState.FAILED, { error: msg });
            }
            this.cleanup();
        }
    }

    async refreshBalanceLive(pin: string) {
        if (this.state === TransactionState.USSD_IN_PROGRESS) {
            return { error: "Action en cours." };
        }
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        const code = `*880*4*${pin}#`;

        // Timeout de sécurité
        this.timeoutId = setTimeout(() => {
            this.updateState(TransactionState.FAILED, { error: "Délai d'attente dépassé (Timeout solde)" });
            this.cleanup();
        }, 30000);

        try {
            this.ussdListener = await UssdBackground.addListener('ussdEvent', async (event) => {
                if (event.isFinal) {
                    const msg = event.message || '';
                    const isError = /incorrect|échoué/i.test(msg);

                    if (event.type === 'response' && !isError) {
                        const match = msg.match(/[cC]ompte[\s:]*([0-9.,]+)/) || msg.match(/Solde[\s:]*([0-9.,]+)/) || msg.match(/([0-9]+)\s*FCFA/i);
                        if (match) {
                            const balance = parseFloat(match[1].replace(/[, ]/g, ''));
                            this.updateState(TransactionState.SUCCESS, { balance, message: msg });
                            try {
                                const { updateBalance } = await import('../users.service');
                                await updateBalance(balance);
                            } catch (e) { }
                        } else {
                            this.updateState(TransactionState.SUCCESS, { message: msg });
                        }
                    } else {
                        this.updateState(TransactionState.FAILED, { error: msg });
                    }
                    this.cleanup();
                }
            });

            await UssdBackground.executeDirectCall({ code });
            return { status: 'success' };
        } catch (e: any) {
            console.error('⚙️ [ENGINE] Error live balance:', e);
            this.updateState(TransactionState.FAILED, { error: String(e) });
            this.cleanup();
            return { status: 'error', message: String(e) };
        }
    }

    async startTransfer(data: { amount: number, recipient: string }) {
        if (this.state === TransactionState.USSD_IN_PROGRESS) return;
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        const resolver = new ContactResolverService();
        const formattedRecipient = resolver.formatBeninNumber(data.recipient);
        const ussdCode = `*880*1*1*${formattedRecipient}*${formattedRecipient}*${data.amount}#`;

        this.timeoutId = setTimeout(() => {
            this.updateState(TransactionState.FAILED, { error: "Délai d'attente dépassé pour la requête USSD." });
            this.cleanup();
        }, 30000);

        try {
            console.log('⚙️ [ENGINE] [FINAL_CODE] Ready:', ussdCode);

            this.ussdListener = await UssdBackground.addListener('ussdEvent', (event) => {
                console.log('📡 [ENGINE] USSD Event:', event);
                this.parseUssdEvent(event);
            });

            console.log('⚙️ [ENGINE] [DEBUG] Executing USSD code via Direct Call to show MTN popup:', ussdCode);
            await UssdBackground.executeDirectCall({ code: ussdCode });
            this.updateState(TransactionState.TRIGGERING_DIALER);
            return { status: 'success', message: 'Appel direct lancé. Suivez les instructions MTN à l\'écran.', dialerFallback: true };
        } catch (e: any) {
            console.error('⚙️ [ENGINE] [ERROR] UssdBackground failed:', e);
            const errorDetail = e.message || String(e);

            if (errorDetail.includes('Permission') || errorDetail.includes('permission')) {
                const msg = 'Permission téléphone manquante. Allez dans les paramètres pour autoriser Voice MoMo.';
                this.updateState(TransactionState.FAILED, { error: msg });
                this.cleanup();
                return { status: 'error', message: msg };
            }

            try {
                console.log('⚙️ [ENGINE] [FALLBACK] Attempting AccessibilityPlugin...');
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
                return { status: 'success', message: 'USSD lancé via Accessibilité.' };
            } catch (e2: any) {
                console.error('⚙️ [ENGINE] [CRITICAL] All silent fallbacks failed:', e2);
                this.updateState(TransactionState.FAILED, { error: `Échec total: le système empêche l'USSD en arrière-plan.` });
                this.cleanup();
                return { status: 'error', message: `Le système n'arrive pas à lancer l'USSD.` };
            }
        }
    }

    async confirmWithPin(pin: string, payload: { phone: string, amount: number }) {
        if (this.state === TransactionState.USSD_IN_PROGRESS) return;
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        const resolver = new ContactResolverService();
        const formattedPhone = resolver.formatBeninNumber(payload.phone);
        const ussdCode = `*880*1*1*${formattedPhone}*${formattedPhone}*${payload.amount}*${pin}#`;

        this.timeoutId = setTimeout(() => {
            this.updateState(TransactionState.FAILED, { error: "Délai d'attente dépassé (Timeout)" });
            this.cleanup();
        }, 30000);

        try {
            this.ussdListener = await UssdBackground.addListener('ussdEvent', (event) => {
                console.log('📡 [ENGINE] USSD Event:', event);
                this.parseUssdEvent(event);
            });

            console.log('⚙️ [ENGINE] [CONFIRM] Executing with PIN via Direct Call:', ussdCode.replace(pin, '****'));

            const response = await UssdBackground.executeDirectCall({ code: ussdCode });
            this.updateState(TransactionState.TRIGGERING_DIALER);
            console.log('✅ [ENGINE] Transfer initiated with response:', response);
        } catch (e: any) {
            console.error('⚙️ [ENGINE] Error in confirmWithPin (Background):', e);
            try {
                console.log('⚙️ [ENGINE] [FALLBACK] Attempting Accessibility for PIN flow...');
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
            } catch (e2: any) {
                console.error('⚙️ [ENGINE] [ERROR] All silent PIN flows failed:', e2);
                this.updateState(TransactionState.FAILED, { error: `Erreur d'exécution du code PIN (Refus du système).` });
                this.cleanup();
            }
        }
    }

    private handleAutoEvent(event: any) {
        console.log("Accessibility USSD Event: ", event);
        if (event.status === 'success') {
            this.parseUssdEvent({ isFinal: true, type: 'response', message: event.message });
        } else if (event.status === 'error') {
            this.updateState(TransactionState.FAILED, { error: event.message });
            this.cleanup();
        } else if (event.status === 'awaiting_pin') {
            this.updateState(TransactionState.FAILED, { error: "Problème PIN côté réseau" });
            this.cleanup();
        }
    }

    private cleanup() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.autoListener) {
            this.autoListener.remove();
            this.autoListener = null;
        }
        if (this.ussdListener) {
            this.ussdListener.remove();
            this.ussdListener = null;
        }
        AccessibilityPlugin.setTransactionActive({ active: false }).catch(() => { });
        this.updateState(TransactionState.INIT);
    }
}
