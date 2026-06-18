# 🎯 Architecture des Actions IA - Gemini Voice Integration

## 📊 Schéma d'Architecture

```
Frontend (React Hook)
    ↓ 🎤 Audio brut
Backend /api/voice-command
    ├─ Gemini Voice Service (STT + NLP + TTS)
    ├─ Action Executor (exécution métier)
    └─ Transaction Cache (gestion confirmations)
    ↓
Response JSON + Audio + Transaction ID (si confirmation)
    ↓
Frontend: Affiche réponse + Joue audio
    ↓ 🎙️ Confirmation vocale (Oui/Non)
Backend /api/confirm ou /api/cancel
    ├─ Récupère transaction du cache
    └─ Exécute l'action confirmée
    ↓
Response: Action exécutée
```

---

## 🔧 Modules Créés

### 1. **transaction_cache.py** - Cache des transactions en attente

**Classe:** `TransactionCache`

**Responsabilités:**
- Stocker les transactions en mémoire (thread-safe)
- Gestion automatique du TTL (expiration)
- Mapping user → transaction

**API:**
```python
cache = get_transaction_cache()

# Ajouter une transaction
tx_id = cache.add(
    user_id="user123",
    intent="transfer",
    amount=5000,
    recipient="Jean",
    ttl=300  # 5 minutes
)

# Récupérer
tx = cache.get_by_id(tx_id)
tx = cache.get_by_user("user123")

# Confirmer/Annuler
tx = cache.confirm(tx_id)
tx = cache.cancel(tx_id)

# Maintenance
cache.cleanup_expired()
cache.size()
```

**Avantages:**
- ✅ Pas de base de données externe
- ✅ Expiration automatique (evite cache plein)
- ✅ Thread-safe avec RLock
- ✅ Mapping user pour "une seule transaction en attente"

---

### 2. **action_executor.py** - Exécuteur d'actions métier

**Classe:** `ActionExecutor`

**Intents Supportés:**
- `balance` - Consulter le solde
- `transfer` - Transfert d'argent
- `recharge` - Recharge crédit téléphonique
- `bill_payment` - Paiement de factures
- `help` - Afficher l'aide

**API Principale:**
```python
executor = get_action_executor()

# Exécuter une action (peut nécessiter confirmation)
result = executor.execute(
    user_id="user123",
    intent=Intent.TRANSFER,
    amount=5000,
    recipient="Jean",
    needs_confirmation=True  # Attend confirmation
)

if result.requires_confirmation:
    print(f"Transaction {result.transaction_id} en attente")
    # → Le frontend reçoit la réponse vocale
    # → L'utilisateur dit "Oui" ou "Non"
    # → Frontend appelle /api/confirm ou /api/cancel
```

**Workflow - Avec Confirmation:**

```
1. Frontend: "Envoie 5000 à Jean"
   ↓
2. Backend: execute(needs_confirmation=True)
   → Création transaction en cache
   → Réponse: "Voulez-vous envoyer 5000 à Jean?"
   ↓
3. Frontend: Joue l'audio + capture confirmation
   User: "Oui"
   ↓
4. Frontend: POST /api/confirm {transaction_id}
   ↓
5. Backend: Exécute le transfert réel
   → Débite le compte
   → Retourne confirmation
   ↓
6. Frontend: Affiche "Transfert réussi"
```

**Workflow - Sans Confirmation:**

```
1. Frontend: "Quel est mon solde?"
   ↓
2. Backend: execute(needs_confirmation=False)
   → Exécute directement
   → Réponse: "Votre solde: 50000 XOF"
   ↓
3. Frontend: Affiche le solde
   (Pas de confirmation nécessaire)
```

**Structure ActionResult:**
```python
{
    "success": true,
    "intent": "transfer",
    "message": "Voulez-vous envoyer 5000 francs CFA à Jean?",
    "requires_confirmation": true,
    "transaction_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "data": {
        "amount": 5000,
        "recipient": "Jean"
    }
}
```

---

### 3. **Modifications à main.py**

**Intégrations:**
1. Import des nouveaux modules
2. Utilisation d'`ActionExecutor` dans `/api/voice-command`
3. Nouveaux endpoints:
   - `POST /api/confirm` - Confirmer une action
   - `POST /api/cancel` - Annuler une action
   - `GET /api/pending-transactions` - DEBUG/monitoring
   - Amélioration `GET /api/health` avec cache stats

**Endpoint /api/voice-command (Modifié):**
```python
# Ancien: Juste analyser et retourner
# Nouveau: Analyser + Exécuter + Retourner résultat d'action

action_result = executor.execute(
    user_id="default",
    intent=nlp_result.intent,
    amount=nlp_result.amount,
    recipient=nlp_result.recipient,
    service_type=nlp_result.bill_type,
    needs_confirmation=nlp_result.needs_confirmation
)

# Response inclut maintenant:
response_data.update(action_result.to_dict())
# → success, transaction_id, data, etc.
```

---

## 🔄 Flux Complet - Exemple: "Envoie 5000 à Jean"

### Étape 1: Capture Audio
```
Frontend: MediaRecorder capture "Envoie 5000 à Jean"
```

### Étape 2: Analyse NLP
```
POST /api/voice-command (audio.wav)
↓
Gemini 2.0 Flash:
- STT: "Envoie 5000 à Jean"
- NLP: intent=transfer, amount=5000, recipient="Jean"
- TTS: "Voulez-vous envoyer 5000 francs CFA à Jean?"
↓
Response NLP: {
    intent: "transfer",
    amount: 5000,
    recipient: "Jean",
    needs_confirmation: true,
    audio_base64: "UklGRi4A..."
}
```

### Étape 3: Exécution Action (Avec Confirmation)
```
ActionExecutor.execute():
- Valide amount > 0 ✓
- Valide recipient ✓
- Vérifie solde ✓
- needs_confirmation=true → Mettre en cache
↓
Response: {
    intent: "transfer",
    success: true,
    message: "Voulez-vous envoyer 5000 francs CFA à Jean?",
    requires_confirmation: true,
    transaction_id: "abc123def456",
    data: { amount: 5000, recipient: "Jean" },
    audio_base64: "UklGRi4A..."
}
```

### Étape 4: Confirmation Vocale
```
Frontend: Joue audio + Web Speech Recognition
User: "Oui"
Frontend: POST /api/confirm {transaction_id: "abc123def456"}
```

### Étape 5: Exécution Confirmée
```
ActionExecutor.confirm_action(tx_id):
- Retirer de cache
- Débiter le compte: balance -= 5000
- Marquer destinataire
↓
Response: {
    success: true,
    intent: "transfer",
    message: "Transfert de 5000 francs CFA à Jean réussi.",
    data: { amount: 5000, recipient: "Jean" }
}
```

### Étape 6: Feedback Final
```
Frontend: Affiche "✅ Transfert de 5000 XOF à Jean réussi"
```

---

## 💾 Schéma de Données

### Transaction en Cache

```
{
    "id": "f47ac10b-...",
    "user_id": "user123",
    "intent": "transfer",
    "amount": 5000,
    "recipient": "Jean",
    "service_type": null,
    "metadata": {...},
    "created_at": "2026-03-24T10:30:00",
    "expires_at": "2026-03-24T10:35:00",
    "ttl": 300
}
```

### User DB (Simulation)
```
{
    "default": {
        "balance": 50000,
        "phone": "+221771234567",
        "name": "User"
    }
}
```

---

## ⚙️ Configuration

### TTL des Transactions
```python
cache.add(..., ttl=300)  # 5 minutes
```

Après 5 minutes, la transaction est automatiquement supprimée du cache.

### Validation
- Amount: `> 0`
- Recipient: Non vide
- Balance: Suffisant

---

## 🧪 Test des Actions

### 1. Balance (Pas de confirmation)
```bash
# User demande: "Quel est mon solde?"
POST /api/voice-command (audio)
↓
Response: {
    intent: "balance",
    success: true,
    message: "Votre solde actuel est de 50000 francs CFA.",
    requires_confirmation: false,
    data: { balance: 50000 }
}
```

### 2. Transfer (Avec confirmation)
```bash
# User demande: "Envoie 5000 à Jean"
POST /api/voice-command (audio)
↓
Response: {
    intent: "transfer",
    success: true,
    message: "Voulez-vous envoyer 5000 francs CFA à Jean?",
    requires_confirmation: true,
    transaction_id: "tx-123"
}

# User répond: "Oui"
POST /api/confirm {transaction_id: "tx-123"}
↓
Response: {
    success: true,
    message: "Transfert de 5000 francs CFA à Jean réussi.",
    data: { amount: 5000, recipient: "Jean" }
}
```

### 3. Cancel Action
```bash
# User répond: "Non"
POST /api/cancel {transaction_id: "tx-123"}
↓
Response: {
    success: true,
    message: "Action annulée: transfer"
}
```

---

## 🔒 Sécurité & Robustesse

**Implémenter en production:**

1. **Authentication:**
   - Récupérer `user_id` du token JWT/session
   - `user_id` doit matcher celui de la transaction

2. **Validation:**
   - Montants max/min
   - Destinataire dans la whitelist
   - Rate limiting (1 transfert/min max)

3. **Audit:**
   - Logger toutes les transactions
   - Enregistrer confirmations/rejets

4. **Erreurs:**
   - Timeout de transaction
   - Rollback si API externe échoue
   - Messages d'erreur clairs

---

## 📈 Monitoring

```bash
# Vérifier la santé + cache
GET /api/health
↓
{
    status: "ok",
    cache_transactions: 2,  // Nombre en attente
    features: [...]
}

# Voir les transactions en attente
GET /api/pending-transactions?user_id=user123
↓
{
    user_id: "user123",
    pending: { ... }
}
```

---

## 🚀 Prochaines Étapes

1. **Intégrer le backend Mobile Money réel**
   - Remplacer simulation user_db
   - Appeler vraies APIs de transfert

2. **Ajouter la persistence**
   - Redis pour cache distribué
   - PostgreSQL pour historique

3. **Sécurité**
   - JWT authentication
   - Rate limiting
   - HTTPS/TLS

4. **Features avancées**
   - Historique des transactions
   - Récipients favoris
   - Batchs de confirmations

---

## 📚 Références

- **transaction_cache.py**: 277 lignes
- **action_executor.py**: 425 lignes  
- **main.py modifications**: 3 nouveaux endpoints

**Total**: ~700 lignes de code architecture complète ✅

