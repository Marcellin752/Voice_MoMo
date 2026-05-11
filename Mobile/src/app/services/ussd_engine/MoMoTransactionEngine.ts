import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { ContactResolverService } from '../engine/ContactResolverService';
import type { AccessibilityPluginInterface } from './AccessibilityPlugin.types';

const AccessibilityPlugin = registerPlugin<AccessibilityPluginInterface>('AccessibilityPlugin');

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
    private onStateChange: ((state: TransactionState, payload?: any) => void) | null = null;

    setStateListener(callback: (state: TransactionState, payload?: any) => void) {
        this.onStateChange = callback;
    }

    private updateState(newState: TransactionState, payload?: any) {
        this.state = newState;
        if (this.onStateChange) this.onStateChange(newState, payload);
    }

    async initiateVoiceTransfer(nlpIntent: any) {
        // 1. Accessibility Check
        const { enabled } = await AccessibilityPlugin.isEnabled();
        if (!enabled) {
            this.updateState(TransactionState.WAITING_ACCESSIBILITY_PERMISSION);
            return { alert: "Veuillez activer l'accessibilité pour Voice MoMo pour exécuter le transfert silencieusement." };
        }

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

        // 3. Prepare Service
        await AccessibilityPlugin.setTransactionActive({ active: true });

        // 4. Request PIN from Internal UI
        this.updateState(TransactionState.AWAITING_PIN_UI);
        console.log('⚙️ [ENGINE] [DEBUG] Awaiting PIN from UI');
        return { promptPin: true, context: { phone, amount: nlpIntent.amount } };
    }

    async startTransfer(data: { amount: number, recipient: string }) {
        console.log('⚙️ [ENGINE] [START] startTransfer:', data);
        // Fallback simple si l'accessibilité n'est pas gérée ou si on veut forcer le dialer
        // Pour l'instant on simule l'appel au dialer directement pour RESTAURER LE FONCTIONNEMENT
        const ussdCode = `*880*1*1*${data.recipient}*${data.amount}#`;
        console.log('⚙️ [ENGINE] [DEBUG] Direct USSD code generated:', ussdCode);
        
        try {
            // Tentative via AppLauncher (Legacy) car c'est le seul qui est "safe"
            const ussdCodeEncoded = ussdCode.replace(/#/g, '%23');
            await AppLauncher.openUrl({ url: `tel:${ussdCodeEncoded}` });
            console.log('⚙️ [ENGINE] [SUCCESS] Dialer opened');
            return { status: 'success', message: 'Dialer ouvert' };
        } catch (e) {
            console.error('⚙️ [ENGINE] [ERROR] Failed to open dialer:', e);
            return { status: 'error', message: 'Échec ouverture dialer' };
        }
    }

    async confirmWithPin(pin: string, payload: {phone: string, amount: number}) {
        this.updateState(TransactionState.USSD_IN_PROGRESS);
        
        if (!this.autoListener) {
            this.autoListener = await AccessibilityPlugin.addListener('ussdAutoEvent', (event: any) => {
                this.handleAutoEvent(event);
            });
        }

        // Cache PIN purely in Runtime for Native Service
        await AccessibilityPlugin.cachePinSecurely({ pin });

        // Execute Dialer (the system will open, our accessibility service will type the pin and close)
        const ussdCode = encodeURIComponent(`*880*1*1*${payload.phone}*${payload.amount}#`);
        await AppLauncher.openUrl({ url: `tel:${ussdCode}` });
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
           // Si MTN pose une autre question ou si le pin était faux
            this.updateState(TransactionState.FAILED, { error: "Problème PIN côté réseau" });
            this.cleanup();
        }
    }

    private cleanup() {
        if (this.autoListener) {
            this.autoListener.remove();
            this.autoListener = null;
        }
        AccessibilityPlugin.setTransactionActive({ active: false });
        this.updateState(TransactionState.INIT);
    }
}
