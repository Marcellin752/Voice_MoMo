# 🎙️ Gemini Voice Service - Documentation d'Intégration

## ✅ État : COMPLÈTEMENT INTÉGRÉ

Tous les composants sont en place et testés syntaxiquement.

---

## 📋 Fichiers Créés/Modifiés

### 1. **`Nlp-module/app/gemini_voice_service.py`** ✨ NOUVEAU
Service vocal complet avec Gemini 2.0 Flash :
- `GeminiVoiceService` : Classe principale
- `process_voice_command()` : Traite audio → NLP → audio réponse
- Retourne `ParseCommandResponse` (compatible avec système existant)
- Gestion gracieuse des erreurs et fallback

### 2. **`Nlp-module/app/main.py`** 📝 MODIFIÉ
Ajout de 3 endpoints:
- ✅ `POST /api/voice-command` - Principal (audio input)
- ✅ `GET /api/health` - Healthcheck du service vocal
- ✅ `POST /ai/parse` - Texte seulement (existant)

---

## 🚀 Comment Utiliser

### A. Démarrer le Service

```bash
cd Voice_MoMo/Nlp-module
source ../.venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### B. Appels API

#### 1️⃣ Commande Vocale Complète (Nouveau!)
```bash
curl -X POST http://localhost:8000/api/voice-command \
  -F "audio_file=@command.wav"
```

**Réponse :**
```json
{
  "intent": "transfer",
  "amount": 5000,
  "recipient": "Jean",
  "needs_confirmation": true,
  "confirmation_message": "Voulez-vous envoyer 5000 XOF à Jean?",
  "audio_base64": "UklGRi4A...",
  "metadata": {
    "provider": "gemini-voice",
    "confidence": 0.95
  }
}
```

#### 2️⃣ Commande Texte (Existant)
```bash
curl -X POST http://localhost:8000/ai/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "Envoie 5000 francs à Jean"}'
```

#### 3️⃣ Healthcheck
```bash
curl http://localhost:8000/api/health
```

---

## 🔧 Architecture

```
Audio File
    ↓
[1. POST /api/voice-command]
    ↓
[2. GeminiVoiceService.process_voice_command()]
    ├─ Audio Input → Gemini 2.0 Flash
    ├─ NLP Analysis (JSON response)
    ├─ Extract Text + Audio parts
    └─ Parse to ParseCommandResponse
    ↓
[3. Intent Router]
    ├─ balance     → Consulte solde
    ├─ transfer    → (needs confirmation)
    ├─ recharge    → 📱 crédit téléphonique
    ├─ bill_payment → 📄 facture
    └─ unknown     → Help text
    ↓
[4. Return]
├─ NLP Result (JSON)
├─ Audio Response (base64 dans JSON)
└─ Confidence score
```

---

## 🎯 Intents Supportés

| Intent | Description | Entities | Exemple |
|--------|-------------|----------|---------|
| `balance` | Consulter solde | - | "Quel est mon solde?" |
| `transfer` | Transfert d'argent | `amount`, `recipient` | "Envoie 5000 à maman" |
| `recharge` | Crédit téléphonique | `amount` | "Recharge 2000" |
| `bill_payment` | Payer facture | `amount`, `bill_type` | "Paye ma facture d'eau" |
| `help` | Demander aide | - | "Aide" |
| `unknown` | Non compris | - | gibberish |

---

## ⚙️ Configuration

### Prérequis
```txt
✅ google-generativeai>=0.3.1    # Dans requirements.txt
✅ GEMINI_API_KEY                 # Dans .env
✅ fastapi, uvicorn              # Déjà présent
```

### Variables d'Environnement (`.env`)
```bash
GEMINI_API_KEY=AIzaSyC... # Clé API Gemini (requis)
ENVIRONMENT=development
```

---

## 🔗 Intégration Backend

Le service retourne `ParseCommandResponse` (compatible avec le système existant).
Pour intégrer les actions, modifiez `/api/voice-command` dans `main.py` :

```python
elif nlp_result.intent.value == "transfer":
    # ✅ COMPLÉTEZ CEC:
    result = await execute_transfer(
        user_id=user_id,
        amount=nlp_result.amount,
        recipient=nlp_result.recipient
    )
    nlp_result.confirmation_message = f"Transfert de {nlp_result.amount} XOF à {nlp_result.recipient} réussi ✅"
```

---

## 🧪 Test Rapide

```bash
# 1. Générer test audio (30 secondes de silence)
ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 1 test.wav

# 2. Envoyer à l'endpoint
curl -X POST http://localhost:8000/api/voice-command \
  -F "audio_file=@test.wav" | jq .

# 3. Vérifier la réponse JSON
```

---

## ⚠️ Limitation Connue

**Async en Free Tier Gemini:**
- `process_voice_command()` est **synchrone** (pas d'async/await)
- Raison: Gemini free tier ne supporte pas les opérations async pour l'audio
- ✅ FastAPI gère quand même les requêtes en parallèle (thread pool)

---

## 📊 Logs

```
📥 Audio reçu (45234 bytes, format: wav)
🧠 Envoi à Gemini 2.0 Flash (audio + voice response)...
📝 Réponse reçue (342 chars)
🔊 Audio de réponse généré (23456 bytes)
✅ Analyse complétée: intent=transfer, confidence=0.95
```

---

## 🐛 Dépannage

### "Pas de réponse texte de Gemini"
- ✅ Vérifiez que le fichier audio est valid
- ✅ Vérifiez `GEMINI_API_KEY` dans `.env`

### "JSON Parse Error"
- ✅ Gemini a retourné du texte au lieu de JSON
- ✅ Le fallback crée une réponse par défaut (intent=`unknown`)

### Pas d'audio dans la réponse
- ✅ Normal si Gemini n'a pas généré l'audio
- ✅ `audio_base64` sera absent du JSON
- ✅ Utilisez le champ `response_message` (texte)

---

## 🎓 Prochaines Étapes

1. **Intégrer méthodes d'action** (balance, transfer, recharge, payment)
2. **Ajouter confirmation requise** (OUI/NON vocaux)
3. **Cacher transactions en attente** (session/cache)
4. **Connecter à Mobile Frontend** (WebRTC pour audio)
5. **Tests e2e** avec vrais fichiers audio

---

## 📞 Références

- [Gemini 2.0 Flash Docs](https://ai.google.dev/gemini-2)
- [FastAPI File Uploads](https://fastapi.tiangolo.com/tutorial/request-files/)
- [ParseCommandResponse Schema](app/models.py)
