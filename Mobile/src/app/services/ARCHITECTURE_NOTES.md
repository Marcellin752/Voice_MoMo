# 🏗️ Notes d'Architecture

## Validation des Numéros Téléphoniques

### ✅ Principe : Valider UNE SEULE FOIS en amont

**Pas de validation redondante dans les engines.**

### 📍 Points de validation

#### 1️⃣ **Numéro UTILISATEUR** (Sender)
```
Où: À l'authentification / login
Quand: Une seule fois au démarrage de l'app
Format: Doit être 01XXXXXXXX (10 chiffres)
Stockage: localStorage['momo.user.phone']
```

**À implémenter:**
- Au login/connexion, appeler `ContactResolverService.formatBeninNumber(userPhone)`
- Valider que le réseau détecté est MTN (pour l'instant)
- Stocker le numéro **formaté** en localStorage

```typescript
// Pseudo-code pour le login
async loginUser(pin: string) {
  const userPhone = getUserPhoneFromServer(); // API
  const formattedPhone = new ContactResolverService().formatBeninNumber(userPhone);
  
  // Vérifier que c'est MTN
  if (NetworkDetector.detectNetwork(formattedPhone) !== MobileNetwork.MTN) {
    throw new Error('Seuls les utilisateurs MTN sont supportés');
  }
  
  localStorage.setItem('momo.user.phone', formattedPhone);
}
```

#### 2️⃣ **Numéro DESTINATAIRE** (Recipient)
```
Où: Dans ContactResolverService.resolve()
Quand: À chaque résolution de contact
Format: Retourne toujours 01XXXXXXXX (10 chiffres)
Source: Contacts de l'utilisateur
```

**Déjà implémenté ✅**
```typescript
// ContactResolverService.resolve() retourne des numéros déjà formatés
const contacts = await resolver.resolve('Jean');
// contacts[0].phone = '0142XXXXXX' (toujours formaté)
```

### 🔄 Flow de Transfert (Validation Simple)

```
1. VoiceIntentProcessor.runWalletTransfer()
   ├─ finalNumber = top.phone (déjà formaté de ContactResolverService)
   └─ userPhone = localStorage (supposé formaté au login)

2. InterNetworkTransferEngine(userPhone, finalNumber)
   ├─ Pas de validation (TRUST les données)
   └─ Juste détection de réseau

3. Construire le code USSD approprié
```

### ❌ Pourquoi PAS de validation redondante ?

- **Inefficace** : Valider plusieurs fois le même numéro
- **Confus** : Plusieurs points possibles de correction
- **Fragile** : Bug dans un point = comportement imprévisible ailleurs
- **DRY violation** : Répétition du même code

### ⚠️ Contrats

```typescript
// InterNetworkTransferEngine : "Je suppose que..."
export class InterNetworkTransferEngine {
  /**
   * ⚠️ CONTRAT :
   * - senderPhone : déjà formaté en 01XXXXXXXX
   * - recipientPhone : déjà formaté en 01XXXXXXXX
   * 
   * Ne pas ajouter de validation ici.
   * L'appelant est responsable du formatage en amont.
   */
  constructor(senderPhone: string, recipientPhone: string) {
    // Juste détection, pas de validation
    this.senderNetwork = NetworkDetector.detectNetwork(senderPhone);
    this.recipientNetwork = NetworkDetector.detectNetwork(recipientPhone);
  }
}
```

### 📋 Checklist Maintenance

- [ ] Valider numéro utilisateur AU LOGIN (une seule fois)
- [ ] ContactResolverService.resolve() retourne toujours des numéros formatés
- [ ] InterNetworkTransferEngine ne valide PAS (fait confiance)
- [ ] Si nouvelles sources de numéros → valider à la source
- [ ] Pas de fallback `|| '01XXXXXXXX'` (c'est masquer un bug)

---

**Dernière mise à jour:** 2026-06-16
