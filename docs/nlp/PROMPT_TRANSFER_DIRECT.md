# 🎯 Prompt Amélioré - Transfert Direct VoiceMomo

## Contexte & Objectif

**Use Case Unique :** Transfert d'argent direct d'un compte A vers un compte B via exécution USSD en backend.

**Philosophie :** Une seule action, parfaitement exécutée, sans friction.

---

## 📋 Nouveau Prompt Système pour Gemini NLP

```python
SYSTEM_PROMPT_TRANSFER_DIRECT = """
Tu es un parseur NLP spécialisé pour les transferts d'argent Mobile Money.
Tu ne gères QUE les transferts d'argent. Rien d'autre.

## TA MISSION UNIQUE
Extraire les informations pour un transfert d'argent et retourner un JSON valide :

{
  "intent": "transfer",
  "amount": <entier>,
  "recipient": "<numéro ou nom>",
  "recipient_type": "phone|contact",
  "confidence": <float 0-1>,
  "missing_info": ["amount"|"recipient"]
}

## RÈGLES D'EXTRACTION STRICTES

### 1. MONTANT (amount)
- Toujours en francs CFA (XOF)
- Extraire les chiffres : "5000", "5000 francs", "5 mille"
- Si montant manquant → missing_info = ["amount"]
- Jamais de décimales (arrondir à l'entier)

### 2. DESTINATAIRE (recipient)
- Numéro de téléphone : 8 à 15 chiffres (ex: "97123456", "+22997123456")
- Nom de contact : "Jean", "Aurel", "maman"
- Si nom → recipient_type = "contact" (sera résolu par le système)
- Si numéro → recipient_type = "phone"

### 3. INTENT
- Toujours "transfer" pour toute commande de transfert
- Mots-clés : "envoie", "transfère", "donne", "envoyer", "transférer"

## EXEMPLES DE COMMANDES ET RÉPONSES

### Exemple 1 : Complet
Commande : "Envoie 5000 francs à 97123456"
Réponse :
{
  "intent": "transfer",
  "amount": 5000,
  "recipient": "97123456",
  "recipient_type": "phone",
  "confidence": 0.98,
  "missing_info": []
}

### Exemple 2 : Avec nom
Commande : "Transfère 10000 à Jean"
Réponse :
{
  "intent": "transfer",
  "amount": 10000,
  "recipient": "Jean",
  "recipient_type": "contact",
  "confidence": 0.95,
  "missing_info": []
}

### Exemple 3 : Montant manquant
Commande : "Envoie de l'argent à 97123456"
Réponse :
{
  "intent": "transfer",
  "amount": null,
  "recipient": "97123456",
  "recipient_type": "phone",
  "confidence": 0.85,
  "missing_info": ["amount"]
}

### Exemple 4 : Destinataire manquant
Commande : "Je veux envoyer 5000 francs"
Réponse :
{
  "intent": "transfer",
  "amount": 5000,
  "recipient": null,
  "recipient_type": null,
  "confidence": 0.80,
  "missing_info": ["recipient"]
}

## CONTRAINTES STRICTES

1. **UNIQUEMENT JSON** - Pas de texte avant/après
2. **Pas de markdown** - JSON brut
3. **Toujours retourner un JSON valide**
4. **Si incompréhension totale** → confidence = 0.2, missing_info = ["amount", "recipient"]

## TRAITEMENT DES CAS SPÉCIAUX

- "solde" → Ce n'est pas un transfert → confidence = 0.2
- "recharge" → Ce n'est pas un transfert → confidence = 0.2
- Nombres ambigus → Contexte détermine si amount ou recipient
- "tout mon argent" → amount = null, missing_info = ["amount"]

## FORMAT DE SORTIE OBLIGATOIRE

{
  "intent": "transfer",
  "amount": <int|null>,
  "recipient": "<string|null>",
  "recipient_type": "phone|contact|null",
  "confidence": <float>,
  "missing_info": ["amount", "recipient"]
}
""".strip()
```

---

## 🔄 Workflow d'Exécution Directe

### Architecture Simplifiée

```
1. Audio → STT → Texte
2. Texte → NLP (prompt ci-dessus) → JSON structuré
3. JSON → Validation → Exécution USSD directe
4. USSD → Résultat → TTS → Audio réponse
```

### Code d'Exécution (Python Backend)

```python
async def execute_transfer_direct(
    user_id: str,
    amount: int,
    recipient: str,
    recipient_type: str,
    country: str = "BJ"
) -> dict:
    """
    Exécute un transfert direct sans confirmation intermédiaire.
    """
    # 1. Résolution du contact si nécessaire
    if recipient_type == "contact":
        recipient = await resolve_contact_name(user_id, recipient)
    
    # 2. Validation
    if not amount or amount <= 0:
        return {"success": False, "error": "Montant invalide"}
    
    if not recipient or len(recipient) < 8:
        return {"success": False, "error": "Destinataire invalide"}
    
    # 3. Vérification solde (optionnel selon configuration)
    balance = await get_user_balance(user_id)
    if balance < amount:
        return {
            "success": False,
            "error": f"Solde insuffisant: {balance} XOF"
        }
    
    # 4. Exécution USSD directe
    try:
        result = await run_ussd_transfer(
            country=country,
            amount=amount,
            recipient=recipient,
            user_pin=await get_user_pin(user_id)
        )
        
        if result["success"]:
            # 5. Notification
            await send_transfer_notification(
                user_id=user_id,
                amount=amount,
                recipient=recipient,
                transaction_id=result["transaction_id"]
            )
            
            return {
                "success": True,
                "message": f"Transfert de {amount} XOF vers {recipient} réussi",
                "transaction_id": result["transaction_id"],
                "new_balance": result.get("new_balance")
            }
        else:
            return {
                "success": False,
                "error": result.get("error", "Échec du transfert")
            }
            
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## 🎯 Message de Confirmation Vocal (TTS)

### Avant exécution (si informations complètes)
```
"Je vais envoyer [MONTANT] francs CFA à [DESTINATAIRE]. C'est confirmé ?"
```

### Si informations manquantes
```
# Montant manquant
"Quel montant voulez-vous envoyer à [DESTINATAIRE] ?"

# Destinataire manquant
"Vers quel numéro ou contact envoyer [MONTANT] francs ?"

# Les deux manquants
"Je peux vous aider à envoyer de l'argent. Quel montant et vers qui ?"
```

### Après succès
```
"Transfert de [MONTANT] francs CFA vers [DESTINATAIRE] réussi. 
Votre nouveau solde est de [NOUVEAU_SOLDE] francs."
```

### Après échec
```
"Échec du transfert : [RAISON]. Voulez-vous réessayer ?"
```

---

## 🛡️ Sécurité & Robustesse

### 1. Validation des Données
```python
def validate_transfer_data(amount: int, recipient: str) -> bool:
    # Montant
    if not isinstance(amount, int) or amount <= 0:
        return False
    
    if amount > 1_000_000:  # Limite journalière
        return False
    
    # Destinataire
    if not recipient or len(recipient) < 8:
        return False
    
    # Format numéro (si c'est un numéro)
    digits = re.sub(r'\D', '', recipient)
    if len(digits) >= 8 and len(digits) <= 15:
        return True
    
    # Sinon c'est un nom de contact (à résoudre)
    return True
```

### 2. Rate Limiting
```python
# Maximum 3 transferts par minute par utilisateur
# Maximum 500 000 XOF par jour
```

### 3. Journalisation (Audit)
```python
async def log_transfer_attempt(
    user_id: str,
    amount: int,
    recipient: str,
    success: bool,
    error: str = None
):
    await db.transfer_logs.insert({
        "user_id": user_id,
        "amount": amount,
        "recipient": recipient,
        "success": success,
        "error": error,
        "timestamp": datetime.now(),
        "ip_address": request.client.host
    })
```

---

## 📊 Métriques de Performance

### Objectifs
- **Temps de réponse total** : < 5 secondes
- **Précision NLP** : > 95%
- **Taux de succès USSD** : > 90%
- **Disponibilité** : 99.9%

### Monitoring
```python
# Métriques à suivre
- Temps moyen d'exécution NLP
- Temps moyen d'exécution USSD
- Taux d'erreur par type
- Nombre de transferts par heure
- Montant moyen transféré
```

---

## 🚀 Déploiement Progressif

### Phase 1 : Test en Environnement Contrôlé
- Mock USSD activé
- Utilisateurs beta limités
- Monitoring renforcé

### Phase 2 : Déploiement Réel Limité
- USSD réel activé
- Limites basses (10 000 XOF max)
- Support client renforcé

### Phase 3 : Production Complète
- Limites augmentées progressivement
- Features avancées (historique, favoris)
- Intégration complète

---

## 📝 Checklist d'Implémentation

- [ ] Mettre à jour `gemini_client.py` avec le nouveau prompt
- [ ] Simplifier `action_executor.py` pour ne garder que transfer
- [ ] Ajouter validation stricte des données
- [ ] Implémenter résolution de contacts
- [ ] Configurer rate limiting
- [ ] Ajouter journalisation complète
- [ ] Tester avec 10 commandes types
- [ ] Déployer en environnement de test
- [ ] Former l'équipe support
- [ ] Documenter pour les utilisateurs

---

## 💡 Avantages de Cette Approche

1. **Simplicité** : Une seule fonctionnalité, parfaitement maîtrisée
2. **Fiabilité** : Moins de cas d'erreur, plus de robustesse
3. **Performance** : Temps de réponse optimisé
4. **Maintenance** : Code plus simple à maintenir
5. **Expérience utilisateur** : Flux clair et prévisible
6. **Sécurité** : Surface d'attaque réduite

---

**Conclusion :** En se concentrant sur un seul use case (transfert d'argent), on peut offrir une expérience exceptionnelle, fiable et sécurisée, avant d'étendre à d'autres fonctionnalités.