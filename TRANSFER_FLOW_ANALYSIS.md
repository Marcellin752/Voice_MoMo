# Analyse Complète du Flux de Transfert MTN MoMo

## Simulation du Processus Complet

### Étape 1: Entrée Utilisateur (VoiceIntentProcessor)
```
Input: {
  intent: "transfer",
  recipient: "Jean Dupont" ou "0195123456",
  amount: 5000
}
```

**Validations dans VoiceIntentProcessor.runWalletTransfer():**
- ✅ Montant validé: 5000 > 0
- ✅ Destinataire non vide: "Jean Dupont"

**Résolution du Contact:**
- Appel à `ContactResolverService.resolve("Jean Dupont")`
- Retour: `[{ name: "Jean Dupont", phone: "0195123456", confidence: 1.0 }]`

**Vérification MTN:**
- Appel à `isMtnBeninNumber("0195123456")`
  - Formatage: `formatBeninNumber("0195123456")` → `"0195123456"` (déjà 10 chiffres)
  - Vérification: commence par "01" ✅
  - Extraction du préfixe: "95" (MTN Bénin) ✅
  - Retour: true ✅

**Retour de VoiceIntentProcessor:**
```javascript
{
  status: 'execute',
  intent: 'transfer',
  data: {
    phone: '0195123456',
    amount: 5000,
    recipientName: 'Jean Dupont'
  }
}
```

---

### Étape 2: Exécution du Transfert (ussd.service.ts)

**Réception du statut 'execute':**
```javascript
if (result && (result as any).status === 'execute') {
  const execData = (result as any).data;  // { phone: '0195123456', amount: 5000, ... }
  const engine = new MoMoTransactionEngine();
  const res = await engine.startTransfer({
    amount: 5000,
    recipient: '0195123456'
  });
}
```

---

### Étape 3: Lancement du Transfert (MoMoTransactionEngine.startTransfer)

**État Initial:**
- `this.state = TransactionState.USSD_IN_PROGRESS`

**Formatage du Numéro:**
```javascript
const resolver = new ContactResolverService();
const formattedRecipient = resolver.formatBeninNumber('0195123456');
// Résultat: '0195123456' (10 chiffres avec 01)
```

**Génération du Code USSD:**
```javascript
const ussdCode = `*880*1*1*${formattedRecipient}*${Math.floor(5000)}#`;
// Résultat: '*880*1*1*0195123456*5000#'
```

**Logs Générés:**
```
⚙️ [ENGINE] [TRANSFER] USSD Final String: *880*1*1*0195123456*5000#
⚙️ [ENGINE] [TRANSFER] Formatted Recipient: 0195123456
⚙️ [ENGINE] [TRANSFER] ASCII Debug: *(42) 8(56) 8(56) 0(48) *(42) 1(49) *(42) 1(49) *(42) 0(48) 1(49) 9(57) 5(53) 1(49) 2(50) 3(51) 4(52) 5(53) 6(54) *(42) 5(53) 0(48) 0(48) 0(48) #(35)
```

**Timeout de Sécurité:**
- Défini à 30 secondes

**Lancement du Code USSD:**
```javascript
await UssdBackground.executeDirectCall({ code: '*880*1*1*0195123456*5000#' });
```

---

### Étape 4: Exécution Native (UssdBackgroundNativePlugin.java)

**Réception du Code:**
```java
String ussdCode = "*880*1*1*0195123456*5000#";
```

**Vérification des Permissions:**
- `CALL_PHONE` permission vérifiée ✅

**Création de l'Intent:**
```java
Intent intent = new Intent(Intent.ACTION_CALL);
String finalCode = ussdCode;  // Déjà terminé par #
intent.setData(Uri.fromParts("tel", finalCode, null));
// URI générée: tel:*880*1*1*0195123456*5000#
intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
getContext().startActivity(intent);
```

**Log:**
```
📡 URI générée via fromParts: tel:*880*1*1*0195123456*5000#
```

---

### Étape 5: Attente de la Confirmation SMS

**État du Moteur:**
- `TransactionState.TRIGGERING_DIALER`

**Listener SMS Activé:**
- Timeout: 45 secondes
- Écoute l'événement `onSMSArrive`

**Scénarios Possibles:**

#### Scénario A: SMS de Succès
```
SMS reçu: "Transfert de 5000 XOF vers 0195123456 confirmé. Solde: 45000 XOF"
```
- Détection: `isLikelyMtnMomoMessage()` ✅
- État: `TransactionState.SUCCESS`
- CustomEvent émis: `momo:transaction-complete`

#### Scénario B: SMS d'Erreur
```
SMS reçu: "Transfert échoué. Numéro invalide."
```
- Détection du pattern: `/insuffisant|incorrect|échoué|invalide|refus|non autorisé|failed/i` ✅
- État: `TransactionState.FAILED`
- CustomEvent émis: `momo:transaction-complete`

#### Scénario C: Timeout (45s sans SMS)
- État: `TransactionState.SUCCESS` (avec `balanceUnknown: true`)
- CustomEvent émis: `momo:transaction-complete`

---

## 🐛 BUGS DÉTECTÉS

### BUG #1: Formatage Agressif du Numéro
**Localisation:** `ContactResolverService.formatBeninNumber()`
**Problème:** 
```typescript
const base8 = digits.slice(-8);
const formatted = '01' + base8;
```
**Scénario Problématique:**
- Input: `"229 95 123456"` (numéro avec indicatif international)
- Extraction: `digits = "22995123456"` (11 chiffres)
- Résultat: `"01" + "5123456"` = `"0151234567"` ❌ (mauvais numéro!)

**Impact:** Les numéros avec indicatif international sont mal traités.

**Correction Proposée:**
```typescript
public formatBeninNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  console.log(`[FORMAT] Raw digits from "${phone}": ${digits}`);

  // Si le numéro commence par 229 (indicatif Bénin), le retirer
  let cleaned = digits;
  if (cleaned.startsWith('229')) {
    cleaned = cleaned.substring(3);
  }

  if (cleaned.length < 8) {
    console.warn(`[FORMAT] Number too short: ${cleaned}`);
    return cleaned;
  }

  const base8 = cleaned.slice(-8);
  const formatted = '01' + base8;
  console.log(`[FORMAT] Result: ${formatted}`);

  return formatted;
}
```

---

### BUG #2: Pas de Validation du Montant Entier
**Localisation:** `MoMoTransactionEngine.startTransfer()`
**Problème:**
```typescript
const ussdCode = `*880*1*1*${formattedRecipient}*${Math.floor(data.amount)}#`;
```
**Scénario Problématique:**
- Input: `amount: 5000.99`
- Résultat: `*880*1*1*0195123456*5000#` ✅ (OK, floor fonctionne)
- Mais pas de log du montant final!

**Impact:** Utilisateur pense envoyer 5000.99 mais envoie 5000. Pas d'avertissement.

**Correction Proposée:**
```typescript
const finalAmount = Math.floor(data.amount);
if (finalAmount !== data.amount) {
  console.warn(`⚠️ [ENGINE] Amount rounded down from ${data.amount} to ${finalAmount}`);
}
const ussdCode = `*880*1*1*${formattedRecipient}*${finalAmount}#`;
```

---

### BUG #3: Pas de Gestion du Cas "Numéro Trop Court"
**Localisation:** `ContactResolverService.formatBeninNumber()`
**Problème:**
```typescript
if (digits.length < 8) {
  console.warn(`[FORMAT] Number too short: ${digits}`);
  return digits;  // ❌ Retourne un numéro invalide!
}
```
**Scénario Problématique:**
- Input: `"123456"` (6 chiffres)
- Retour: `"123456"` (pas de préfixe 01)
- Code USSD: `*880*1*1*123456*5000#` ❌ (invalide!)

**Impact:** Numéro invalide envoyé au réseau → erreur "Numéro invalide"

**Correction Proposée:**
```typescript
if (digits.length < 8) {
  console.error(`[FORMAT] Number too short (${digits.length} digits): ${digits}`);
  throw new Error(`Numéro trop court: ${digits}. Minimum 8 chiffres requis.`);
}
```

---

### BUG #4: Pas de Vérification du Format Final du Numéro
**Localisation:** `MoMoTransactionEngine.startTransfer()`
**Problème:**
```typescript
const formattedRecipient = resolver.formatBeninNumber(data.recipient);
// Pas de vérification que formattedRecipient a exactement 10 chiffres!
const ussdCode = `*880*1*1*${formattedRecipient}*${Math.floor(data.amount)}#`;
```
**Scénario Problématique:**
- `formatBeninNumber()` retourne `"123456"` (trop court)
- Code USSD généré: `*880*1*1*123456*5000#` ❌

**Impact:** Code USSD invalide envoyé au réseau

**Correction Proposée:**
```typescript
const formattedRecipient = resolver.formatBeninNumber(data.recipient);

// Validation stricte du format
if (!/^01\d{8}$/.test(formattedRecipient)) {
  throw new Error(`Format de numéro invalide: ${formattedRecipient}. Doit être 01XXXXXXXX`);
}

const ussdCode = `*880*1*1*${formattedRecipient}*${Math.floor(data.amount)}#`;
```

---

### BUG #5: Pas de Gestion d'Erreur dans ussd.service.ts
**Localisation:** `ussd.service.ts` (ligne 386-390)
**Problème:**
```typescript
const engine = new MoMoTransactionEngine();
const res = await engine.startTransfer({
  amount: execData.amount,
  recipient: execData.phone
});

if (!res) {  // ❌ Condition faible!
  return { success: false, message: 'Erreur lors de l\'initialisation du transfert.' };
}
```
**Scénario Problématique:**
- Si `startTransfer()` lance une exception (throw), elle n'est pas attrapée!
- L'exception remonte et crash l'application

**Impact:** Crash de l'application au lieu d'un message d'erreur gracieux

**Correction Proposée:**
```typescript
try {
  const engine = new MoMoTransactionEngine();
  const res = await engine.startTransfer({
    amount: execData.amount,
    recipient: execData.phone
  });

  if (!res) {
    return { success: false, message: 'Erreur lors de l\'initialisation du transfert.', action: intentName };
  }

  return {
    success: res.status === 'success',
    message: res.message || 'Transaction initiée.',
    action: intentName,
    dialerFallback: !!res.dialerFallback
  };
} catch (error) {
  console.error('🔥 [USSD_SERVICE] Erreur lors du transfert:', error);
  return {
    success: false,
    message: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
    action: intentName
  };
}
```

---

### BUG #6: Pas de Vérification du Montant Minimum
**Localisation:** `VoiceIntentProcessor.runWalletTransfer()`
**Problème:**
```typescript
if (amount == null || Number(amount) <= 0) {
  return { status: 'error', message: 'Montant manquant ou invalide.' };
}
// Pas de vérification du montant minimum!
```
**Scénario Problématique:**
- Input: `amount: 1` (1 XOF)
- Validation: ✅ (1 > 0)
- Code USSD: `*880*1*1*0195123456*1#`
- Réseau MTN: ❌ Rejet (montant minimum probablement 100 XOF)

**Impact:** Transfert rejeté par le réseau avec message d'erreur cryptique

**Correction Proposée:**
```typescript
const MIN_TRANSFER_AMOUNT = 100;  // XOF
const MAX_TRANSFER_AMOUNT = 500000;  // XOF

if (amount == null || Number(amount) < MIN_TRANSFER_AMOUNT || Number(amount) > MAX_TRANSFER_AMOUNT) {
  return { 
    status: 'error', 
    message: `Montant invalide. Doit être entre ${MIN_TRANSFER_AMOUNT} et ${MAX_TRANSFER_AMOUNT} XOF.` 
  };
}
```

---

### BUG #7: État de Transition Incohérent
**Localisation:** `MoMoTransactionEngine._waitForSmsConfirmation()`
**Problème:**
```typescript
} else if (this.state !== TransactionState.SUCCESS) {
  this.updateState(TransactionState.SUCCESS, {
    ...detail,
    balanceUnknown: true,
  });
}
```
**Scénario Problématique:**
- Timeout SMS après 45 secondes
- État: `TransactionState.TRIGGERING_DIALER`
- Transition: `TransactionState.SUCCESS` (même sans confirmation!)
- UI affiche "Succès" alors que le transfert n'est pas confirmé

**Impact:** Utilisateur pense que le transfert a réussi alors qu'il ne sait pas

**Correction Proposée:**
```typescript
} else if (this.state !== TransactionState.SUCCESS) {
  // Timeout: on ne sait pas si le transfert a réussi
  console.warn('⚠️ [SMS_CONFIRM] Timeout: pas de SMS de confirmation reçu');
  this.updateState(TransactionState.SUCCESS, {
    ...detail,
    balanceUnknown: true,
    timeout: true,  // Flag pour indiquer que c'est un timeout
  });
}
```

---

### BUG #8: Pas de Validation de la Réponse executeDirectCall
**Localisation:** `MoMoTransactionEngine.startTransfer()`
**Problème:**
```typescript
await UssdBackground.executeDirectCall({ code: ussdCode });

this.updateState(TransactionState.TRIGGERING_DIALER);
this._waitForSmsConfirmation(data.amount);

return { 
  status: 'success',  // ❌ On dit "succès" alors qu'on vient juste de lancer l'appel!
  message: 'Transfert initié. Veuillez suivre les instructions MTN sur votre écran (Motif puis PIN).',
  dialerFallback: true 
};
```
**Scénario Problématique:**
- `executeDirectCall()` lance l'Intent Android
- Mais l'Intent peut échouer silencieusement (permissions, etc.)
- On retourne `status: 'success'` même si l'appel n'a pas été lancé

**Impact:** Utilisateur pense que le transfert est lancé alors qu'il ne l'est pas

**Correction Proposée:**
```typescript
try {
  console.log('⚙️ [ENGINE] [DEBUG] Launching interactive USSD via Direct Call...');
  await UssdBackground.executeDirectCall({ code: ussdCode });
  
  console.log('✅ [ENGINE] [TRANSFER] USSD call launched successfully');
  this.updateState(TransactionState.TRIGGERING_DIALER);
  
  this._waitForSmsConfirmation(data.amount);
  
  return { 
    status: 'initiated',  // "initiated" au lieu de "success"
    message: 'Transfert initié. Veuillez suivre les instructions MTN sur votre écran (Motif puis PIN).',
    dialerFallback: true 
  };
} catch (e: any) {
  console.error('⚙️ [ENGINE] [ERROR] Failed to launch USSD call:', e);
  const msg = formatUssdFailureMessage(e, null);
  this.updateState(TransactionState.FAILED, { error: msg });
  this.cleanup();
  return { status: 'error', message: msg };
}
```

---

## 📋 Résumé des Bugs

| # | Sévérité | Localisation | Problème | Impact |
|---|----------|--------------|---------|--------|
| 1 | 🔴 HAUTE | ContactResolverService | Formatage agressif avec indicatif international | Numéro invalide |
| 2 | 🟡 MOYENNE | MoMoTransactionEngine | Pas de log du montant arrondi | Confusion utilisateur |
| 3 | 🔴 HAUTE | ContactResolverService | Pas de gestion du numéro trop court | Numéro invalide |
| 4 | 🔴 HAUTE | MoMoTransactionEngine | Pas de validation du format final | Code USSD invalide |
| 5 | 🔴 HAUTE | ussd.service.ts | Pas de try-catch | Crash application |
| 6 | 🟡 MOYENNE | VoiceIntentProcessor | Pas de montant minimum | Rejet réseau |
| 7 | 🟡 MOYENNE | MoMoTransactionEngine | État SUCCESS sur timeout | Fausse confirmation |
| 8 | 🟡 MOYENNE | MoMoTransactionEngine | Pas de validation de executeDirectCall | Fausse confirmation |

---

## ✅ Corrections à Appliquer

1. Améliorer `formatBeninNumber()` pour gérer l'indicatif international
2. Ajouter validation stricte du format final (01XXXXXXXX)
3. Ajouter try-catch dans `ussd.service.ts`
4. Ajouter montant minimum/maximum
5. Améliorer la gestion des états de transition
6. Ajouter validation de la réponse `executeDirectCall()`
