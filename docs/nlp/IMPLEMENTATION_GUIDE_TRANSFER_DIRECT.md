# 📖 Guide d'Implémentation - Transfert Direct VoiceMomo

## 🎯 Objectif

Ce guide détaille les étapes pour implémenter la fonctionnalité de transfert d'argent direct dans VoiceMomo, en se concentrant sur une exécution USSD backend fiable.

---

## 📋 Prérequis

- [x] Avoir lu `PROMPT_TRANSFER_DIRECT.md`
- [x] Comprendre l'architecture USSD existante
- [x] Avoir accès au backend TypeScript
- [x] Avoir configuré Gemini API

---

## 🔧 Modifications Requises

### 1. Module NLP (`gemini_client.py`)

**Fichier:** `Voice_MoMo/Nlp-module/app/gemini_client.py`

**Statut:** ✅ **DÉJÀ MODIFIÉ**

Le prompt a été mis à jour pour se concentrer uniquement sur les transferts d'argent.

**Nouveau format de réponse:**
```json
{
  "intent": "transfer",
  "amount": 5000,
  "currency": "XOF",
  "recipient": "97123456",
  "recipient_type": "phone",
  "confidence": 0.98,
  "missing_info": [],
  "needs_confirmation": true
}
```

---

### 2. Module d'Exécution (`action_executor.py`)

**Fichier:** `Voice_MoMo/Nlp-module/app/action_executor.py`

**Modifications nécessaires:**

#### A. Simplifier le handler de transfert

```python
def _handle_transfer(
    self,
    user_id: str,
    amount: Optional[float],
    recipient: Optional[str],
    needs_confirmation: bool
) -> ActionResult:
    """
    Transfert direct - exécution immédiate si toutes les infos sont présentes.
    """
    amount_value = self._normalized_amount(amount)
    recipient_value = self._normalized_recipient(recipient)

    logger.info(f"💸 Transfert direct: {amount_value} XOF → {recipient_value}")
    
    # Validation stricte
    if amount_value is None:
        return ActionResult(
            success=False,
            intent=Intent.TRANSFER.value,
            message="Montant invalide ou manquant. Veuillez préciser le montant."
        )
    
    if not recipient_value:
        return ActionResult(
            success=False,
            intent=Intent.TRANSFER.value,
            message="Destinataire non spécifié. Veuillez préciser le numéro ou le nom."
        )
    
    # Vérifier solde
    user = self.users_db.get(user_id) or self.users_db["default"]
    balance = user.get("balance", 0)
    
    if balance < amount_value:
        return ActionResult(
            success=False,
            intent=Intent.TRANSFER.value,
            message=f"Solde insuffisant. Solde actuel: {format_amount_for_tts(balance)} XOF"
        )
    
    # Exécution DIRECTE (pas de confirmation intermédiaire)
    return self._execute_transfer(user_id, amount_value, recipient_value)
```

#### B. Exécution USSD directe

```python
def _execute_transfer(
    self,
    user_id: str,
    amount: float,
    recipient: str,
    transaction_id: Optional[str] = None
) -> ActionResult:
    """
    Exécution USSD directe en backend.
    """
    logger.info(f"✅ Exécution transfert USSD: {amount} XOF → {recipient}")
    
    # 1. Tenter d'exécuter via backend USSD
    backend_result = self._execute_via_backend(
        Intent.TRANSFER, 
        amount, 
        recipient, 
        None, 
        transaction_id
    )
    
    if backend_result:
        # Succès du backend USSD
        return backend_result
    
    # 2. Fallback: Simulation locale (pour développement)
    logger.warning("Backend non disponible, utilisation du mode simulation")
    user = self.users_db.get(user_id) or self.users_db["default"]
    user["balance"] = user.get("balance", 0) - amount
    
    if transaction_id:
        self.cache.confirm(transaction_id)
    
    return ActionResult(
        success=True,
        intent=Intent.TRANSFER.value,
        message=f"Transfert de {format_amount_for_tts(amount)} francs CFA vers {format_recipient_for_tts(recipient)} réussi.",
        transaction_id=transaction_id,
        data={"amount": amount, "recipient": recipient},
    )
```

---

### 3. Backend TypeScript (`Backend/src/`)

**Fichier:** `Voice_MoMo/Backend/src/api/controllers/transaction.controller.ts`

**Ajouter un endpoint dédié:**

```typescript
/**
 * POST /api/v1/transfer
 * Exécute un transfert direct via USSD
 */
export const executeDirectTransfer = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId, amount, recipient, country = "BJ" } = req.body;
    
    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Montant invalide"
      });
    }
    
    if (!recipient || recipient.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Destinataire invalide"
      });
    }
    
    // Récupérer le PIN chiffré de l'utilisateur
    const encryptedPin = await getUserPin(userId);
    
    // Préparer le payload USSD
    const payload: UssdJobPayload = {
      country,
      action: "transfer",
      params: {
        amount,
        to: recipient,
      },
      encryptedPin,
    };
    
    // Exécuter la session USSD
    const result = await runUssdSession(payload);
    
    // Retourner la réponse
    return res.json({
      success: result.parse.success,
      message: result.voiceResponse,
      transactionId: generateTransactionId(),
      data: {
        amount,
        recipient,
        newBalance: result.parse.newBalance,
      }
    });
    
  } catch (error) {
    logger.error("Transfer execution error", error);
    return res.status(500).json({
      success: false,
      error: "Échec du transfert"
    });
  }
};
```

---

## 🔄 Workflow Complet

### Étape 1: Capture Audio
```
Utilisateur: "Envoie 5000 francs à 97123456"
     ↓
Frontend: Capture audio → STT → Texte
```

### Étape 2: Analyse NLP
```
POST /api/voice-command (audio)
     ↓
Gemini NLP (avec nouveau prompt):
{
  "intent": "transfer",
  "amount": 5000,
  "recipient": "97123456",
  "recipient_type": "phone",
  "confidence": 0.98,
  "missing_info": [],
  "needs_confirmation": true
}
```

### Étape 3: Validation & Exécution Directe
```
ActionExecutor._handle_transfer():
  1. Valide amount = 5000 ✓
  2. Valide recipient = "97123456" ✓
  3. Vérifie solde = 50000 > 5000 ✓
  4. Exécute DIRECTEMENT (pas de confirmation)
     ↓
  5. Appelle backend USSD
     ↓
  6. USSD exécute: *880*1*97123456*5000#
     ↓
  7. PIN requis → envoyé automatiquement
     ↓
  8. Confirmation USSD → "1" envoyé automatiquement
     ↓
  9. Résultat: "Transfer successful"
```

### Étape 4: Réponse Vocale
```
TTS: "Transfert de 5000 francs CFA vers 97123456 réussi."
     ↓
Frontend: Joue audio + affiche confirmation
```

---

## 🛡️ Sécurité

### 1. Validation des Données
```python
def validate_transfer(amount: int, recipient: str, user_id: str) -> bool:
    # Montant
    if not isinstance(amount, int) or amount <= 0:
        return False
    if amount > 1_000_000:  # 1M FCFA max
        return False
    
    # Destinataire
    digits = re.sub(r'\D', '', recipient)
    if len(digits) < 8 or len(digits) > 15:
        return False
    
    # Utilisateur
    if not user_id or len(user_id) < 3:
        return False
    
    return True
```

### 2. Rate Limiting
```python
# Maximum 3 transferts par minute
# Maximum 500 000 FCFA par jour
# Maximum 1 000 000 FCFA par mois
```

### 3. Journalisation (Audit)
```python
async def log_transfer(
    user_id: str,
    amount: int,
    recipient: str,
    success: bool,
    transaction_id: str,
    error: str = None
):
    await db.transfer_logs.create({
        data: {
            user_id,
            amount,
            recipient,
            success,
            transaction_id,
            error,
            timestamp: datetime.now(),
            ip_address: request.client.host,
            user_agent: request.headers.get("user-agent"),
        }
    })
```

---

## 🧪 Tests

### Scénarios de Test

#### Test 1: Transfert complet
```bash
# Commande: "Envoie 5000 francs à 97123456"
curl -X POST http://localhost:8000/api/voice-command \
  -F "audio=@test_transfer.wav"

# Réponse attendue:
{
  "success": true,
  "intent": "transfer",
  "message": "Transfert de 5000 francs CFA vers 97123456 réussi.",
  "transaction_id": "tx-123456",
  "data": {
    "amount": 5000,
    "recipient": "97123456"
  }
}
```

#### Test 2: Montant manquant
```bash
# Commande: "Envoie de l'argent à 97123456"
# Réponse attendue:
{
  "success": false,
  "intent": "transfer",
  "message": "Montant invalide ou manquant. Veuillez préciser le montant."
}
```

#### Test 3: Solde insuffisant
```bash
# Commande: "Envoie 1000000 francs à 97123456"
# (si solde = 50000)
# Réponse attendue:
{
  "success": false,
  "intent": "transfer",
  "message": "Solde insuffisant. Solde actuel: 50000 XOF"
}
```

---

## 📊 Monitoring

### Métriques à Suivre

```python
# 1. Performance
- Temps moyen NLP: < 2s
- Temps moyen USSD: < 3s
- Temps total: < 5s

# 2. Fiabilité
- Taux de succès NLP: > 95%
- Taux de succès USSD: > 90%
- Taux d'erreur: < 5%

# 3. Usage
- Nombre de transferts/heure
- Montant moyen transféré
- Destinataires uniques
```

### Dashboard

```python
# Endpoint de monitoring
GET /api/transfer-stats

# Réponse:
{
  "total_transfers": 1234,
  "success_rate": 0.95,
  "avg_amount": 15000,
  "avg_time_seconds": 4.2,
  "last_24h": {
    "transfers": 156,
    "success": 148,
    "failed": 8
  }
}
```

---

## 🚀 Déploiement

### Phase 1: Développement (1-2 jours)
- [x] Mettre à jour le prompt Gemini
- [ ] Modifier `action_executor.py`
- [ ] Ajouter endpoint TypeScript
- [ ] Tests unitaires

### Phase 2: Test Interne (2-3 jours)
- [ ] Tests avec mock USSD
- [ ] Tests avec vrais numéros
- [ ] Validation sécurité
- [ ] Correction bugs

### Phase 3: Beta Limitée (1 semaine)
- [ ] 10 utilisateurs beta
- [ ] Monitoring renforcé
- [ ] Support client dédié
- [ ] Limites basses (10 000 FCFA max)

### Phase 4: Production (progressif)
- [ ] Augmenter limites progressivement
- [ ] Ouvrir à tous les utilisateurs
- [ ] Ajouter features avancées

---

## 💡 Bonnes Pratiques

### 1. Messages d'Erreur Clairs
```python
# ❌ Mauvais
"Erreur de transfert"

# ✅ Bon
"Le numéro 97123456 n'est pas valide. Veuillez vérifier et réessayer."
```

### 2. Confirmation Verbale
```python
# Avant exécution (si toutes infos présentes)
"Je vais envoyer 5000 francs CFA à 97123456. C'est confirmé ?"

# Après succès
"Transfert de 5000 francs CFA vers 97123456 réussi. Votre nouveau solde est de 45000 francs."
```

### 3. Gestion des Échecs
```python
# Si USSD échoue
"Échec du transfert : solde insuffisant. Votre solde actuel est de 3000 francs. Voulez-vous réessayer avec un montant inférieur ?"
```

---

## 📞 Support

### Questions Fréquentes

**Q: Que se passe-t-il si l'USSD échoue ?**
R: Le système retourne un message d'erreur clair et propose de réessayer.

**Q: Comment annuler un transfert ?**
R: Impossible une fois exécuté. D'où l'importance de la confirmation vocale avant.

**Q: Quelle est la limite de montant ?**
R: 1 000 000 FCFA par transfert, 500 000 FCFA par jour.

**Q: Combien de temps prend un transfert ?**
R: Moins de 5 secondes en moyenne.

---

## ✅ Checklist Finale

Avant de déployer en production:

- [ ] Prompt Gemini testé avec 50 commandes types
- [ ] Action executor simplifié et testé
- [ ] Backend TypeScript déployé
- [ ] Tests de sécurité passés
- [ ] Rate limiting configuré
- [ ] Journalisation activée
- [ ] Monitoring en place
- [ ] Équipe support formée
- [ ] Documentation utilisateur créée
- [ ] Beta testeurs recrutés

---

**Prochaine étape:** Commencer par la Phase 1 (Développement) en suivant ce guide étape par étape.