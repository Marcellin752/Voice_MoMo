import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { ContactResolverService } from '../engine/ContactResolverService';
import { SmsListenerService } from '../sms.service';
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
            console.log('⚙️ [ENGINE] [DEBUG] Raw recipient:', data.recipient);
            console.log('⚙️ [ENGINE] [DEBUG] Formatted recipient:', formattedRecipient);
            console.log('⚙️ [ENGINE] [DEBUG] Amount:', data.amount);
            console.log('⚙️ [ENGINE] [FINAL_CODE] Ready:', ussdCode);

            this.ussdListener = await UssdBackground.addListener('ussdEvent', (event) => {
                console.log('📡 [ENGINE] USSD Event:', event);
                this.parseUssdEvent(event);
            });

            console.log('⚙️ [ENGINE] [DEBUG] Executing silent USSD in background:', ussdCode);
            const response = await UssdBackground.executeUssd({ code: ussdCode });
            console.log('✅ [ENGINE] Silent transfer initiated:', response);

            if (response && response.status === 'success' && response.isFinal) {
                this.updateState(TransactionState.SUCCESS, { message: response.message });
                this.cleanup();
            } else {
                // USSD envoyé mais pas de confirmation directe → attendre le SMS de confirmation MTN
                console.log('📩 [ENGINE] USSD envoyé, écoute du SMS de confirmation MTN...');
                this._waitForSmsConfirmation(data.amount);
            }

            return { status: 'success', message: 'Opération lancée. En attente de confirmation MTN...', dialerFallback: false };
        } catch (e: any) {
            console.error('⚙️ [ENGINE] [ERROR] Silent USSD failed:', e);
            const errorDetail = e.message || String(e);

            if (errorDetail.includes('Permission') || errorDetail.includes('permission')) {
                const msg = 'Permission téléphone manquante. Allez dans les paramètres pour autoriser Voice MoMo.';
                this.updateState(TransactionState.FAILED, { error: msg });
                this.cleanup();
                return { status: 'error', message: msg };
            }

            // Fallback d'Accessibilité si le silence complet bloque ou n'est pas supporté
            try {
                console.log('⚙️ [ENGINE] [FALLBACK] Attempting AccessibilityPlugin...');
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
                // Même en fallback, on attend le SMS
                this._waitForSmsConfirmation(data.amount);
                return { status: 'success', message: 'USSD lancé via Accessibilité. En attente du SMS de confirmation...' };
            } catch (e2: any) {
                console.error('⚙️ [ENGINE] [ERROR] AccessibilityPlugin failed:', e2);

                const msg = 'Impossible d’exécuter en arrière-plan. Tentative d’appel direct...';
                console.warn(msg);

                try {
                    console.log('⚙️ [ENGINE] [FALLBACK] Launching ACTION_CALL...');
                    await UssdBackground.executeDirectCall({ code: ussdCode });
                    this.updateState(TransactionState.TRIGGERING_DIALER);
                    // En mode appel direct, on attend aussi le SMS
                    this._waitForSmsConfirmation(data.amount);
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

    /**
     * Écoute l'arrivée d'un SMS MTN MoMo pour confirmer le succès d'une transaction.
     * Utilise directement l'événement DOM 'onSMSArrive' pour ne pas entrer en conflit
     * avec le listener SMS permanent de HomeScreen.
     * Émet un CustomEvent 'momo:transaction-complete' que l'UI peut écouter.
     */
    private _waitForSmsConfirmation(_expectedAmount?: number): void {
        const SMS_TIMEOUT_MS = 45000;
        let smsTimeoutId: any = null;
        let resolved = false;

        console.log('📩 [SMS_CONFIRM] En attente du SMS MTN (timeout 45s)...');

        const finish = (success: boolean, detail: Record<string, any>) => {
            if (resolved) return;
            resolved = true;
            if (smsTimeoutId) clearTimeout(smsTimeoutId);
            document.removeEventListener('onSMSArrive', onSmsArrive);

            // Émettre un CustomEvent pour que l'UI (HomeScreen) puisse réagir
            window.dispatchEvent(new CustomEvent('momo:transaction-complete', { detail }));

            if (success) {
                this.updateState(TransactionState.SUCCESS, detail);
            } else if (this.state !== TransactionState.SUCCESS) {
                this.updateState(TransactionState.SUCCESS, {
                    ...detail,
                    balanceUnknown: true,
                });
            }
            this.cleanup();
        };

        const onSmsArrive = (e: Event) => {
            if (resolved) return;
            const sms = (e as any).data || e;
            const body: string = sms.body || sms.text || sms.message || '';
            const address: string = sms.address || sms.originatingAddress || sms.phone || '';

            if (!SmsListenerService.isLikelyMtnMomoMessage(address, body)) return;

            console.log('📩 [SMS_CONFIRM] SMS MTN intercepté:', body);

            // Échec explicite renvoyé par MTN
            if (/insuffisant|incorrect|échoué|invalide|refus|non autorisé|failed/i.test(body)) {
                console.warn('❌ [SMS_CONFIRM] SMS indique un échec.');
                document.removeEventListener('onSMSArrive', onSmsArrive);
                if (smsTimeoutId) clearTimeout(smsTimeoutId);
                resolved = true;
                window.dispatchEvent(new CustomEvent('momo:transaction-complete', {
                    detail: { success: false, message: body }
                }));
                this.updateState(TransactionState.FAILED, { error: body });
                this.cleanup();
                return;
            }

            const balanceResult = SmsListenerService.extractBalanceWithPriority(body);
            if (balanceResult !== null) {
                const newBalance = balanceResult.value;
                console.log(`✅ [SMS_CONFIRM] Nouveau solde: ${newBalance} FCFA`);
                import('../users.service').then(({ updateBalance }) => {
                    updateBalance(newBalance).catch((err: any) =>
                        console.warn('⚠️ [SMS_CONFIRM] updateBalance failed:', err)
                    );
                });
                finish(true, {
                    success: true,
                    message: `Transaction réussie ! Nouveau solde : ${newBalance.toLocaleString('fr-FR')} FCFA.`,
                    balance: newBalance,
                });
            } else {
                // SMS MTN reçu sans montant lisible → présumer succès
                finish(true, { success: true, message: 'Transaction confirmée par MTN.' });
            }
        };

        document.addEventListener('onSMSArrive', onSmsArrive);

        // Timeout 45s : si aucun SMS, on présume que l'USSD est parti et on laisse HomeScreen
        // mettre à jour le solde quand un SMS arrive plus tard.
        smsTimeoutId = setTimeout(() => {
            console.warn('⏱️ [SMS_CONFIRM] Timeout 45s — aucun SMS MTN reçu.');
            finish(false, {
                success: false,
                message: 'Transaction envoyée. Vérifiez votre historique MoMo si le solde ne se met pas à jour.',
            });
        }, SMS_TIMEOUT_MS);
    }

    async confirmWithPin(pin: string, payload: { phone: string, amount: number }) {
        if (this.state === TransactionState.USSD_IN_PROGRESS) return;
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        const resolver = new ContactResolverService();
        const formattedPhone = resolver.formatBeninNumber(payload.phone);
        const ussdCode = `*880*1*1*${formattedPhone}*${formattedPhone}*${payload.amount}#`;

        this.timeoutId = setTimeout(() => {
            this.updateState(TransactionState.FAILED, { error: "Délai d'attente dépassé (Timeout)" });
            this.cleanup();
        }, 30000);

        try {
            this.ussdListener = await UssdBackground.addListener('ussdEvent', (event) => {
                console.log('📡 [ENGINE] USSD Event:', event);
                this.parseUssdEvent(event);
            });

            console.log('⚙️ [ENGINE] [CONFIRM] Executing silent USSD with PIN in background:', ussdCode.replace(pin, '****'));

            const response = await UssdBackground.executeUssd({ code: ussdCode });
            console.log('✅ [ENGINE] Silent PIN execution response:', response);

            if (response && response.status === 'success' && response.isFinal) {
                this.updateState(TransactionState.SUCCESS, { message: response.message });
                this.cleanup();
            } else {
                // Pas de réponse directe : attendre le SMS de confirmation MTN
                console.log('📩 [ENGINE] USSD PIN envoyé, écoute du SMS MTN...');
                this._waitForSmsConfirmation(payload.amount);
            }
        } catch (e: any) {
            console.error('⚙️ [ENGINE] Error in confirmWithPin (Background):', e);
            try {
                console.log('⚙️ [ENGINE] [FALLBACK] Attempting Accessibility for PIN flow...');
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
                this._waitForSmsConfirmation(payload.amount);
            } catch (e2: any) {
                console.error('⚙️ [ENGINE] [ERROR] All silent PIN flows failed:', e2);
                try {
                    await UssdBackground.executeDirectCall({ code: ussdCode });
                    this.updateState(TransactionState.TRIGGERING_DIALER);
                    this._waitForSmsConfirmation(payload.amount);
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
