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
        // UX: Message humain pour les erreurs de double SIM
        return `La transaction n'a pas abouti. Si vous avez deux cartes SIM, vérifiez que MTN MoMo est sur la bonne puce.`;
    }
    if (joined.includes('Permission') || joined.includes('permission')) {
        // UX: Message clair pour les permissions
        return 'Voice MoMo a besoin d\'accéder au téléphone pour envoyer de l\'argent. Veuillez autoriser l\'accès dans les paramètres.';
    }
    // UX: Message générique humain
    return "La transaction n'a pas pu être lancée. Vérifiez votre connexion réseau et réessayez.";
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

// UX Fix #11: Référence vers le moteur de la transaction en cours.
// Les moteurs sont instanciés localement à chaque transfert (ussd.service, hooks) ;
// ce registre permet à l'UI d'annuler la transaction active sans en détenir l'instance.
let activeEngine: MoMoTransactionEngine | null = null;

/**
 * Fraîcheur maximale d'un solde lu dans les SMS avant de déclencher une
 * vérification USSD live (qui, elle, exige le PIN). En dessous de ce seuil, on
 * répond directement avec le solde du SMS (gratuit, instantané, sans PIN).
 *
 * Compromis : trop court → l'utilisateur saisit son PIN trop souvent ; trop long
 * → risque d'annoncer un solde périmé si une opération a eu lieu sans SMS lisible.
 * 60 min est un point d'équilibre raisonnable, ajustable ici si besoin.
 */
export const BALANCE_FRESHNESS_MS = 60 * 60 * 1000;

/** Annule la transaction en cours s'il y en a une (bouton Annuler / commande vocale "stop"). */
export function cancelActiveTransaction(): { cancelled: boolean; message: string } {
    if (!activeEngine) {
        return { cancelled: false, message: 'Aucune transaction en cours.' };
    }
    return activeEngine.cancel();
}

export class MoMoTransactionEngine {
    state = TransactionState.INIT;
    private autoListener: PluginListenerHandle | null = null;
    private ussdListener: PluginListenerHandle | null = null;
    private timeoutId: any = null;
    private onStateChange: ((state: TransactionState, payload?: any) => void) | null = null;
    // UX Fix #11: Annulation utilisateur en cours de transaction
    private cancelRequested = false;
    private smsWaitAbort: (() => void) | null = null;

    setStateListener(callback: (state: TransactionState, payload?: any) => void) {
        this.onStateChange = callback;
    }

    private updateState(newState: TransactionState, payload?: any) {
        this.state = newState;
        if (this.onStateChange) this.onStateChange(newState, payload);
    }

    /**
     * UX Fix #11: Annule la transaction en cours.
     * Avant le lancement USSD : empêche l'envoi (aucun argent ne part).
     * Après le lancement : arrête le suivi SMS, avec un message honnête
     * car l'USSD ne peut plus être rappelé côté réseau MTN.
     */
    cancel(): { cancelled: boolean; message: string } {
        this.cancelRequested = true;
        const launched = this.state === TransactionState.TRIGGERING_DIALER;
        console.log('🛑 [ENGINE] [CANCEL] Annulation demandée. USSD déjà lancé:', launched);
        if (this.smsWaitAbort) {
            this.smsWaitAbort();
            this.smsWaitAbort = null;
        }
        this.cleanup();
        return launched
            ? { cancelled: true, message: "J'ai arrêté le suivi de la transaction. Si vous avez déjà validé avec votre code PIN, vérifiez vos SMS MTN pour savoir si l'argent est parti." }
            : { cancelled: true, message: "Transfert annulé. Aucun argent n'a été envoyé." };
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

        // 1. Résolution du contact
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

        // 2. Lancement direct du transfert interactif (Motif + PIN gérés par MTN)
        console.log('⚙️ [ENGINE] [DEBUG] Launching interactive transfer directly');
        return await this.startTransfer({ amount, recipient: phone });
    }

    /**
     * Consultation du solde.
     * Source prioritaire : le SMS MTN le plus récent (gratuit, sans PIN).
     * Si aucun solde RÉCENT n'est trouvé (cf. BALANCE_FRESHNESS_MS), on signale
     * à l'UI qu'un PIN est nécessaire pour lancer une vérification USSD live.
     */
    async checkBalance() {
        console.log('⚙️ [ENGINE] [START] checkBalance (SMS d\'abord)');
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        try {
            const { SmsListenerService } = await import('../sms.service');
            const hit = await SmsListenerService.readLatestBalanceWithDate();

            const ageMs = hit ? Date.now() - hit.date : Infinity;
            const isFresh = hit !== null && ageMs <= BALANCE_FRESHNESS_MS;

            if (isFresh) {
                const balance = hit!.value;
                console.log(`✅ [ENGINE] [SUCCESS] Solde SMS récent: ${balance} (âge ${Math.round(ageMs / 60000)} min)`);
                // Le message est vocalisé tel quel par le hook : il doit contenir le solde réel
                const message = `Votre solde MoMo est de ${balance.toLocaleString('fr-FR')} francs CFA.`;
                this.updateState(TransactionState.SUCCESS, { balance, message });

                try {
                    const { updateBalance } = await import('../users.service');
                    await updateBalance(balance);
                } catch (e) {
                    console.warn('⚠️ [ENGINE] Could not save balance to backend:', e);
                }

                return { status: 'success', balance, message };
            }

            // Pas de solde récent → vérification USSD live (nécessite le PIN).
            // On délègue à l'UI l'ouverture de la modale PIN via le signal promptPin.
            console.log('🔐 [ENGINE] Aucun solde SMS récent → demande de PIN pour USSD live');
            this.updateState(TransactionState.INIT);
            return {
                status: 'need_pin',
                promptPin: true,
                context: { mode: 'balance' as const },
                message: 'Pour consulter votre solde à jour, entrez votre code PIN MTN.',
            };
        } catch (e) {
            console.error('⚙️ [ENGINE] [ERROR] Failed to read balance from SMS:', e);
            this.updateState(TransactionState.FAILED, { error: String(e) });
            return { status: 'error', message: "Je n'ai pas pu lire votre solde. Vérifiez que l'accès aux SMS est autorisé dans les paramètres." };
        }
    }

    /**
     * Vérification USSD live du solde (*880*4*PIN#), promisifiée : résout avec le
     * solde dès l'arrivée de l'événement USSD final (ou timeout/erreur).
     * Diffuse `momo:balance-updated` pour que l'UI (HomeScreen) se mette à jour.
     */
    async checkBalanceWithPin(pin: string): Promise<{ status: string; balance?: number; message: string }> {
        if (this.state === TransactionState.USSD_IN_PROGRESS) {
            return { status: 'error', message: 'Une opération est déjà en cours.' };
        }
        this.updateState(TransactionState.USSD_IN_PROGRESS);
        const code = `*880*4*${pin}#`;

        return new Promise((resolve) => {
            let settled = false;
            const finish = (result: { status: string; balance?: number; message: string }) => {
                if (settled) return;
                settled = true;
                if (typeof result.balance === 'number') {
                    window.dispatchEvent(new CustomEvent('momo:balance-updated', {
                        detail: { balance: result.balance },
                    }));
                    import('../users.service')
                        .then(({ updateBalance }) => updateBalance(result.balance!))
                        .catch(() => { });
                }
                this.cleanup();
                resolve(result);
            };

            this.timeoutId = setTimeout(() => {
                finish({ status: 'error', message: "Le réseau MTN n'a pas répondu à temps. Réessayez dans un instant." });
            }, 30000);

            UssdBackground.addListener('ussdEvent', (event) => {
                if (!event.isFinal) return;
                const msg = event.message || '';
                const isError = /incorrect|échoué|invalide/i.test(msg);
                if (event.type === 'response' && !isError) {
                    const match = msg.match(/[cC]ompte[\s:]*([0-9.,]+)/) || msg.match(/[sS]olde[\s:]*([0-9.,]+)/) || msg.match(/([0-9][0-9.,\s]*)\s*FCFA/i);
                    if (match) {
                        const balance = parseFloat(match[1].replace(/[,\s]/g, ''));
                        finish({ status: 'success', balance, message: `Votre solde MoMo est de ${balance.toLocaleString('fr-FR')} francs CFA.` });
                    } else {
                        finish({ status: 'success', message: msg || 'Solde reçu de MTN.' });
                    }
                } else {
                    finish({ status: 'error', message: msg || 'Le code PIN semble incorrect. Réessayez.' });
                }
            }).then((listener) => {
                this.ussdListener = listener;
                return UssdBackground.executeDirectCall({ code });
            }).catch((e: any) => {
                console.error('⚙️ [ENGINE] Error live balance (PIN):', e);
                finish({ status: 'error', message: "Je n'ai pas pu lancer la vérification du solde. Vérifiez vos permissions téléphone." });
            });
        });
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

    /**
     * Rafraîchissement manuel du solde (bouton 🔄 du HomeScreen).
     * Délègue à checkBalanceWithPin pour résoudre réellement avec le solde
     * (l'ancienne version retournait avant l'arrivée de l'événement USSD).
     */
    async refreshBalanceLive(pin: string) {
        return this.checkBalanceWithPin(pin);
    }

    async startTransfer(data: { amount: number, recipient: string }) {
        if (this.state === TransactionState.USSD_IN_PROGRESS) return;
        // UX Fix #11: Enregistrer ce moteur comme transaction active (annulable depuis l'UI)
        this.cancelRequested = false;
        activeEngine = this;
        this.updateState(TransactionState.USSD_IN_PROGRESS);

        const resolver = new ContactResolverService();
        
        try {
            // BUG #1 & #3 FIX: Formatage avec gestion des erreurs
            const formattedRecipient = resolver.formatBeninNumber(data.recipient);
            
            // BUG #4 FIX: Validation stricte du format final (01XXXXXXXX)
            if (!/^01\d{8}$/.test(formattedRecipient)) {
                throw new Error(`Format de numéro invalide: ${formattedRecipient}. Doit être 01XXXXXXXX (10 chiffres).`);
            }
            
            // BUG #2 FIX: Log du montant arrondi
            const finalAmount = Math.floor(data.amount);
            if (finalAmount !== data.amount) {
                console.warn(`⚠️ [ENGINE] Amount rounded down from ${data.amount} to ${finalAmount}`);
            }
            
            // Pour MTN Bénin, le transfert interactif utilise *880*1*1*NUMERO*MONTANT#
            const ussdCode = `*880*1*1*${formattedRecipient}*${finalAmount}#`;

            console.log('⚙️ [ENGINE] [TRANSFER] USSD Final String:', ussdCode);
            console.log('⚙️ [ENGINE] [TRANSFER] Formatted Recipient:', formattedRecipient);
            console.log('⚙️ [ENGINE] [TRANSFER] Final Amount:', finalAmount);
            
            // Log ASCII pour détecter des caractères cachés
            let ascii = "";
            for(let i=0; i<ussdCode.length; i++) {
                ascii += `${ussdCode[i]}(${ussdCode.charCodeAt(i)}) `;
            }
            console.log('⚙️ [ENGINE] [TRANSFER] ASCII Debug:', ascii);

            this.timeoutId = setTimeout(() => {
                this.updateState(TransactionState.FAILED, { error: "Délai d'attente dépassé pour la requête USSD." });
                this.cleanup();
            }, 30000);

            // IMPORTANT: Cacher le numéro formaté pour l'AccessibilityService
            // Si MTN affiche "Numero invalide, ajoutez 01...", le service auto-remplira
            try {
                await AccessibilityPlugin.cacheRecipient({ recipient: formattedRecipient });
                console.log('⚙️ [ENGINE] Cached recipient for auto-fill:', formattedRecipient);
            } catch (e) {
                console.warn('⚙️ [ENGINE] Could not cache recipient (AccessibilityService may not be enabled)');
            }

            console.log('⚙️ [ENGINE] [TRANSFER] Interactive flow start:', ussdCode);

            // UX Fix #11: Dernier point d'annulation possible avant l'envoi réel au réseau
            if (this.cancelRequested) {
                console.log('🛑 [ENGINE] [CANCEL] Transfert interrompu avant le lancement USSD.');
                this.cleanup();
                return { status: 'cancelled', message: "Transfert annulé. Aucun argent n'a été envoyé." };
            }

            // PRIORITÉ : Utiliser executeDirectCall pour permettre l'interaction système (Motif + PIN)
            // car les API silencieuses bloquent souvent les pop-ups interactifs de l'opérateur.
            console.log('⚙️ [ENGINE] [DEBUG] Launching interactive USSD via Direct Call...');
            await UssdBackground.executeDirectCall({ code: ussdCode });
            
            console.log('✅ [ENGINE] [TRANSFER] USSD call launched successfully');
            this.updateState(TransactionState.TRIGGERING_DIALER);
            
            // On lance l'écoute du SMS de confirmation
            this._waitForSmsConfirmation(data.amount);
            
            return { 
                status: 'initiated', 
                // UX: Message clair avec guidance
                message: 'Transfert en cours ! Suivez les instructions qui s\'affichent : entrez le motif puis votre code PIN MTN.', 
                dialerFallback: true 
            };
        } catch (e: any) {
            console.error('⚙️ [ENGINE] [ERROR] Interactive transfer failed:', e);
            const msg = e instanceof Error ? e.message : 'Impossible de lancer le transfert. Vérifiez vos permissions téléphone.';
            this.updateState(TransactionState.FAILED, { error: msg });
            this.cleanup();
            return { status: 'error', message: msg };
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
            this.smsWaitAbort = null;

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

        // UX Fix #11: Permettre à cancel() d'interrompre proprement l'attente du SMS
        this.smsWaitAbort = () => {
            if (resolved) return;
            resolved = true;
            if (smsTimeoutId) clearTimeout(smsTimeoutId);
            document.removeEventListener('onSMSArrive', onSmsArrive);
        };

        // Timeout 45s : si aucun SMS, on présume que l'USSD est parti et on laisse HomeScreen
        // mettre à jour le solde quand un SMS arrive plus tard.
        smsTimeoutId = setTimeout(() => {
            console.warn('⏱️ [SMS_CONFIRM] Timeout 45s — aucun SMS MTN reçu.');
            // UX Fix #4: Message clair sur le timeout - pas de fausse confirmation
            finish(false, {
                success: false,
                message: 'Je n\'ai pas reçu de confirmation de MTN. L\'argent n\'a probablement PAS été envoyé. Voulez-vous réessayer ?',
                timeout: true,
            });
        }, SMS_TIMEOUT_MS);
    }

    async confirmWithPin(pin: string, payload: { phone: string, amount: number }): Promise<{ status: string; message: string }> {
        if (this.state === TransactionState.USSD_IN_PROGRESS) {
            return { status: 'error', message: 'Une transaction est déjà en cours.' };
        }
        // UX Fix #11: Enregistrer ce moteur comme transaction active (annulable depuis l'UI)
        this.cancelRequested = false;
        activeEngine = this;
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
                return { status: 'success', message: response.message || 'Transaction réussie !' };
            } else {
                // Pas de réponse directe : attendre le SMS de confirmation MTN
                console.log('📩 [ENGINE] USSD PIN envoyé, écoute du SMS MTN...');
                this._waitForSmsConfirmation(payload.amount);
                return { status: 'initiated', message: 'Transaction en cours. Suivez les instructions sur votre écran.' };
            }
        } catch (e: any) {
            console.error('⚙️ [ENGINE] Error in confirmWithPin (Background):', e);
            try {
                console.log('⚙️ [ENGINE] [FALLBACK] Attempting Accessibility for PIN flow...');
                await AccessibilityPlugin.executeUssd({ code: ussdCode });
                this._waitForSmsConfirmation(payload.amount);
                return { status: 'initiated', message: 'Transaction en cours. Suivez les instructions sur votre écran.' };
            } catch (e2: any) {
                console.error('⚙️ [ENGINE] [ERROR] All silent PIN flows failed:', e2);
                try {
                    await UssdBackground.executeDirectCall({ code: ussdCode });
                    this.updateState(TransactionState.TRIGGERING_DIALER);
                    this._waitForSmsConfirmation(payload.amount);
                    return { status: 'initiated', message: 'Transaction en cours. Entrez votre code PIN MTN sur l\'écran.' };
                } catch (e3: any) {
                    const finalErr = e3.message || String(e3);
                    this.updateState(TransactionState.FAILED, { error: `Erreur PIN: ${finalErr}` });
                    this.cleanup();
                    return { status: 'error', message: `Erreur: ${finalErr}` };
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
        // UX Fix #11: La transaction n'est plus active, donc plus annulable
        if (activeEngine === this) activeEngine = null;
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
