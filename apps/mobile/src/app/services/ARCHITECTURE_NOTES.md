# 🏗️ Notes d'Architecture

## Validation des Numéros Téléphoniques

### ✅ Principe : Valider UNE SEULE FOIS en amont

**Pas de validation redondante dans les engines.**

### 📍 Points de validation

#### 1️⃣ **Numéro UTILISATEUR** (Sender)
```
Où: À l'authentification (AuthContext.setAuth)
Quand: Une seule fois à la connexion ; restauré au démarrage
Format: 01XXXXXXXX (10 chiffres) — vient du serveur
Stockage: StorageService → clé 'momo.auth.user' (objet ApiUser)
Type: ApiUser = { id: string; phone: string }
```

**Comment le récupérer (état actuel ✅) :**
```typescript
import { StorageService } from '../storage.service';
import type { ApiUser } from '../../utils/api';

const authUser = await StorageService.get<ApiUser>('momo.auth.user');
const userPhone = authUser?.phone;
if (!userPhone || userPhone.trim() === '') {
  throw new Error('Numéro utilisateur non configuré. Veuillez vous reconnecter.');
}
```

> ⚠️ **NE PAS** utiliser `getProfile()` de `utils/localData.ts` : il lit la clé
> `momo.profile`, qui n'est **jamais remplie au login** et renvoie `phone: ""`.
> C'était la cause de l'erreur « Numéro utilisateur non configuré ».
> La seule source de vérité pour le numéro du sender est `momo.auth.user`.

**À implémenter (TODO — pas encore fait) :**
- Au login, normaliser via `ContactResolverService.formatBeninNumber(userPhone)`
  avant de stocker (le serveur n'est pas garanti de renvoyer le format 01XXXXXXXX).
- Vérifier que le réseau détecté est MTN (seul réseau émetteur supporté).

```typescript
// Pseudo-code pour AuthContext.setAuth (à ajouter)
const formattedPhone = new ContactResolverService().formatBeninNumber(newUser.phone);
if (NetworkDetector.detectNetwork(formattedPhone) !== MobileNetwork.MTN) {
  throw new Error('Seuls les utilisateurs MTN sont supportés');
}
await StorageService.set('momo.auth.user', { ...newUser, phone: formattedPhone });
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
   └─ userPhone = StorageService.get('momo.auth.user').phone

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

- [x] Lire le numéro sender depuis `momo.auth.user` (PAS `getProfile()`)
- [ ] Formater/valider le numéro utilisateur AU LOGIN (TODO dans AuthContext.setAuth)
- [x] ContactResolverService.resolve() retourne toujours des numéros formatés
- [x] InterNetworkTransferEngine ne valide PAS (fait confiance)
- [ ] Si nouvelles sources de numéros → valider à la source
- [ ] Pas de fallback `|| '01XXXXXXXX'` (c'est masquer un bug)

### 🗂️ Carte des stockages (à ne pas confondre)

| Clé | Écrite par | Contient | Source de vérité pour… |
|-----|-----------|----------|------------------------|
| `momo.auth.user` | `AuthContext.setAuth` | `ApiUser { id, phone }` | **le numéro du sender** ✅ |
| `momo.profile` | *(jamais écrite au login)* | `ProfileData` (phone vide) | rien — **ne pas lire** ❌ |

---

**Dernière mise à jour:** 2026-06-16
