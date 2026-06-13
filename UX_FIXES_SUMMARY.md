# Résumé des Corrections UX — Bloquants 🔴, Frustrants 🟠 et Irritants 🟡

Référence : `UX_AUDIT_VOICE_MOMO.md`

## 📊 État des 5 bloquants

| # | Bloquant | Fichier | État |
|---|----------|---------|------|
| 1 | Message d'erreur USSD technique | `MoMoTransactionEngine.ts` (`formatUssdFailureMessage`) | ✅ Déjà corrigé |
| 2 | "Numéro trop court" sans guidance | `ContactResolverService.ts` (`formatBeninNumber`) | ✅ Déjà corrigé |
| 3 | Pas de feedback pendant le traitement long | `useVoiceAssistant.ts`, `useVoiceAssistantNLP.ts` | ✅ **Corrigé (cette session)** |
| 4 | Timeout SMS silencieux après 45s | `MoMoTransactionEngine.ts` (`_waitForSmsConfirmation`) | ✅ Déjà corrigé |
| 5 | Contact introuvable = fin de parcours | `VoiceIntentProcessor.ts` (`runWalletTransfer`) | ✅ Déjà corrigé |

---

## 🔧 Bloquant #3 : Feedback progressif pendant les traitements longs

### Problème
Pendant l'analyse vocale (Gemini) et l'exécution USSD, l'utilisateur voyait soit
"Traitement en cours..." figé, soit l'ancien message "Je vous écoute..." qui ne
changeait pas. Après ~10 secondes de silence, il pensait que l'app avait planté
et la fermait — parfois en pleine transaction.

### Solution
Nouveau module `Mobile/src/app/utils/progressiveFeedback.ts` :

- `startProgressiveFeedback(setFeedback, steps)` affiche des messages d'attente
  échelonnés et retourne une fonction d'arrêt (annule les timers dès que la
  réponse arrive, pour ne jamais écraser le message final).
- Deux séquences prédéfinies :
  - **`NLP_PROCESSING_STEPS`** (analyse vocale) :
    "Je traite votre demande..." → 4s → "J'analyse votre message vocal..." → 9s → "Encore un instant, presque terminé..."
  - **`USSD_PROCESSING_STEPS`** (réseau MTN) :
    "Je traite votre demande..." → 4s → "Connexion au réseau MTN..." → 10s → "Le réseau MTN met un peu de temps à répondre. Merci de patienter..."

### Points branchés

**`useVoiceAssistantNLP.ts`** (hook principal) :
- `sendAudioToBackend` — analyse vocale (étapes NLP)
- `triggerUSSD` — exécution USSD (étapes MTN) ; couvre aussi `resolveAmbiguity`
- `confirmAction` — confirmation `/api/confirm` (étapes NLP)
- `executeTransferWithPin` — transfert avec PIN (étapes MTN)
- Nettoyage des timers au démontage du hook (`useEffect` cleanup)

**`useVoiceAssistant.ts`** (hook legacy/web) :
- `stopListening` (mode voiceAi) — remplace le "Traitement en cours..." statique

### Corrections annexes (messages d'erreur humanisés au passage)
- `sendAudioToBackend` catch : "Erreur backend: 500" → "Je n'ai pas pu traiter votre demande. Vérifiez votre connexion internet et réessayez."
- `confirmAction` catch : erreur silencieuse → "La confirmation n'a pas abouti. Veuillez réessayer."
- `executeTransferWithPin` catch : erreur silencieuse → "Le transfert n'a pas pu être lancé. Votre argent n'a pas été débité. Veuillez réessayer."

---

## 📊 État des 6 frustrants 🟠

| # | Frustrant | État |
|---|-----------|------|
| 6 | Pas de confirmation vocale du montant | ✅ Géré côté NLP (`confirmation_message` + `needs_confirmation`) |
| 7 | Ambiguïté contacts sans guidance vocale | ✅ Déjà corrigé (UX Fix #7 dans `triggerUSSD`) |
| 8 | Messages d'erreur techniques | ✅ Déjà corrigé (UX Fix #8) |
| 9 | Pas de reprise après échec de reconnaissance | ✅ **Corrigé (cette session)** |
| 10 | PIN sans contexte | ✅ Déjà corrigé (UX Fix #10) |
| 11 | Pas d'annulation en cours de transaction | ✅ **Corrigé (cette session)** |

---

## 🔧 Frustrant #9 : Reprise automatique après échec de reconnaissance

### Problème
Quand la reconnaissance vocale échouait ("no match", bruit, parole trop faible),
l'app affichait "Je n'ai pas bien entendu" puis retombait à idle. L'utilisateur
devait rappuyer sur le micro — friction inutile, surtout en conduite ou les mains prises.

### Solution
Relance automatique de l'écoute, **1 tentative max** (compteur `autoRetryRef` /
`retryCountRef`) pour éviter les boucles infinies. Le compteur est remis à zéro
à chaque appui manuel sur le micro et à chaque commande comprise.

- **`useVoiceAssistantNLP.ts`** : si le NLP retourne `success: false` ou intent
  `unknown`, l'app joue le message d'erreur puis relance l'écoute avec
  "J'écoute à nouveau...".
- **`useVoiceAssistant.ts`** (web) : `rec.onerror` relance `rec.start()` après le
  message vocal ; `rec.onend` ne retombe plus à idle quand une relance est imminente
  (`retryPendingRef`).
- **`useVoiceAssistant.ts`** (natif) : nouveau handler `handleNativeSrFailure` ;
  les rejets de la promesse `SR.start()` (ERROR_NO_MATCH Android) sont désormais
  capturés — avant, ils passaient totalement silencieusement.
- Les erreurs de **permission micro** ne déclenchent jamais de relance (message
  d'explication à la place).

---

## 🔧 Frustrant #11 : Annulation en cours de transaction

### Problème
Une fois le transfert lancé, aucun moyen d'interrompre. L'utilisateur qui
réalisait son erreur (mauvais contact, mauvais montant) ne pouvait que subir.

### Solution — 3 couches

**1. Moteur (`MoMoTransactionEngine.ts`)**
- Registre module-level `activeEngine` + export `cancelActiveTransaction()` :
  l'UI peut annuler sans détenir l'instance du moteur (ils sont créés localement
  dans `ussd.service.ts` et les hooks).
- Méthode `cancel()` avec message honnête selon le stade :
  - avant lancement USSD → "Transfert annulé. Aucun argent n'a été envoyé."
  - après lancement (`TRIGGERING_DIALER`) → "J'ai arrêté le suivi... vérifiez vos
    SMS MTN" (l'USSD ne peut plus être rappelé côté réseau).
- Drapeau `cancelRequested` vérifié **juste avant** `executeDirectCall` (dernier
  point d'interruption réelle).
- `smsWaitAbort` : `cancel()` interrompt proprement l'attente du SMS de confirmation.

**2. Hook (`useVoiceAssistantNLP.ts`)**
- `cancelEpochRef` : un "Annuler" pendant l'analyse NLP ou la confirmation
  invalide le pipeline — une réponse arrivée après l'annulation **ne déclenche
  jamais l'USSD** (corrige une vraie course critique).
- `cancelAction` appelle `cancelActiveTransaction()` et vocalise le résultat.
- Commande vocale **"stop" / "annule"** (intent NLP `cancel`) : annule aussi la
  transaction active (avant, elle répondait "Opération réussie" !).

**3. UI (`Layout.tsx`)**
- Bouton **Annuler** affiché sous le micro pendant `status === 'processing'`.
- Les boutons Confirmer/Annuler de confirmation ne s'affichent plus que pendant
  `awaiting_confirmation` (avant, ils restaient visibles pendant le traitement).

---

## 📊 État des 7 irritants 🟡

| # | Irritant | État |
|---|----------|------|
| 12 | "Je vous écoute..." trop générique | ✅ Déjà corrigé (exemple de commande affiché) |
| 13 | Délai retour à idle trop court | ✅ Déjà corrigé (8 s) |
| 14 | Pas de son/vibration à l'écoute | ✅ **Corrigé (cette session)** |
| 15 | Solde masqué sans explication | ✅ **Corrigé (cette session)** |
| 16 | Toasts succès/échec peu distincts | ✅ Déjà corrigé (vert `toast.success` / ambre `toast.warning`) |
| 17 | Pas d'historique des commandes vocales | ✅ Couvert : la bulle du Layout affiche la transcription au-dessus du feedback pendant 8 s |
| 18 | "XOF" au lieu de "francs CFA" | ✅ Déjà corrigé (`VoiceIntentProcessor`) |

---

## 🔧 Irritant #14 : Bip + vibration au démarrage de l'écoute

### Problème
L'écoute démarrait silencieusement : l'utilisateur ne savait pas si le micro
était actif et parlait parfois avant ou après la fenêtre d'écoute.

### Solution
Nouveau module `Mobile/src/app/utils/audioCues.ts` — `playListeningStartCue()` :
- **Vibration** courte (50 ms) via `navigator.vibrate` — permission `VIBRATE`
  ajoutée à `AndroidManifest.xml` (permission normale, sans prompt runtime).
- **Bip** discret (880 Hz, ~150 ms, volume faible) via Web Audio API — aucun
  plugin supplémentaire nécessaire.
- Appelé aux 4 points de démarrage d'écoute : `useVoiceAssistantNLP.startListening`,
  et les 3 branches de `useVoiceAssistant` (voiceAi, web `rec.onstart`, natif).

---

## 🔧 Irritant #15 : Solde masqué sans explication

### Problème
Le solde affichait "••••••" sans indice ; l'icône œil était discrète et
l'utilisateur ne savait pas comment voir son solde.

### Solution (`HomeScreen.tsx`)
- Le montant masqué est désormais **touchable directement** (bouton avec
  `aria-label`) en plus de l'icône œil.
- Texte d'aide "👆 Touchez pour afficher votre solde" affiché sous le montant
  quand il est masqué.

---

## ✅ Vérification

- `npm run build` (Vite) : ✅ build OK sans erreur
- Tests manuels recommandés sur device (SIM MTN réelle) :
  1. **Feedback progressif (#3)** : lancer un transfert vocal et vérifier que les
     messages d'attente défilent pendant l'analyse puis pendant l'USSD, et que le
     message final n'est jamais écrasé par un message d'attente tardif.
  2. **Reprise auto (#9)** : appuyer sur le micro et rester silencieux → l'app doit
     dire "Je n'ai pas bien compris. J'écoute à nouveau..." et relancer l'écoute
     **une seule fois**, puis afficher l'erreur si nouvel échec.
  3. **Annulation (#11)** :
     - Appuyer sur Annuler pendant "Je traite votre demande..." → aucun USSD ne
       doit partir, message "Transfert annulé. Aucun argent n'a été envoyé."
     - Appuyer sur Annuler pendant l'attente du SMS (après validation PIN) →
       message invitant à vérifier les SMS MTN.
     - Dire "stop" ou "annule" au micro pendant une transaction → même comportement.
