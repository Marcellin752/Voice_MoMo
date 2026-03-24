# 🎙️ VoiceMomo - AI Voice Command System

> **Système complet de décodage vocal en IA pour applications Mobile Money**

## 🚀 Vue d'ensemble

VoiceMomo est une plateforme production-ready de traitement de commandes vocales en français, conçue pour les applications d'argent mobile. Elle utilise Gemini 2.0 Flash pour la reconnaissance vocale et la compréhension du langage naturel.

### Fonctionnalités principales

✅ **Reconnaissance Vocale** - STT avec Gemini 2.0 Flash  
✅ **NLP Avancé** - Extraction intent + entités (montant, destinaire, etc.)  
✅ **Synthèse Vocale** - TTS français haute qualité  
✅ **Authentification JWT** - Sécurité inter-services  
✅ **Cache Transactionnel** - TTL + expiration auto  
✅ **Persistence DB** - PostgreSQL optionnel  
✅ **Rate Limiting** - Protection DDOS  
✅ **Monitoring** - Health checks + métriques  
✅ **Swagger/OpenAPI** - Documentation interactive  
✅ **Tests Intégration** - Suite complète pytest  

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Mobile Frontend (React)            │
│   - MediaRecorder (capture audio)   │
│   - WebSocket (streaming)           │
└────────────┬────────────────────────┘
             │ JWT Auth
             │ Audio Upload
             ▼
┌─────────────────────────────────────┐
│   FastAPI Backend (NLP Module)       │
│   - /api/voice-command              │
│   - /api/confirm                    │
│   - /api/cancel                     │
└─────┬──────────────┬────────────────┘
      │              │
      ▼              ▼
  ┌─────────┐   ┌──────────────┐
  │ Gemini  │   │ Action       │
  │ 2.0 Flash │   │ Executor     │
  └─────────┘   └──┬───────────┘
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
  ┌──────────┐          ┌─────────────┐
  │Cache     │          │PostgreSQL   │
  │(in-mem)  │          │(optionnel)  │
  └──────────┘          └─────────────┘
```

---

## 🔧 Installation

### 1. Cloner le repo

```bash
git clone https://github.com/satignon/VoiceMomo.git
cd Voice_MoMo/Nlp-module
```

### 2. Créer l'environnement Python

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate      # Windows
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configurer les variables d'environnement

```bash
cp .env.example .env
# Éditer .env avec vos clés API
nano .env
```

**Variables essentielles**:
```bash
GEMINI_API_KEY=VOTRE-CLÉ-API-GEMINI
JWT_SECRET=votre-secret-jwt-complexe
DATABASE_URL=postgresql://user:pass@localhost/voice_momo
```

### 5. Initialiser la base de données (optionnel)

```bash
# Si USE_POSTGRES=true dans .env
createdb voice_momo
python -c "from app.transaction_persistence import PostgresTransactionPersistence; p = PostgresTransactionPersistence(); p.connect()"
```

---

## 🚀 Lancer le service

```bash
# Mode développement
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Mode production
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
```

### Vérifier que ça marche

```bash
# Health check
curl http://localhost:8000/api/health

# Accéder à Swagger
open http://localhost:8000/docs
```

---

## 🔐 Authentification

### Générer un token JWT (Développement)

```bash
# Générer un token pour user123
curl http://localhost:8000/api/auth/token?user_id=user123

# Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user_id": "user123",
  "expires_in": "24h"
}
```

### Utiliser le token

```bash
# Inclure dans le header Authorization
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..." \
     http://localhost:8000/api/voice-command \
     -F "audio_file=@command.wav"
```

---

## 🎙️ Flux Vocal Complet

### Étape 1: Capturer l'audio

```typescript
import { useVoiceAssistantNLP } from '@/app/hooks/useVoiceAssistantNLP';

function VoiceWidget() {
  const { startListening, status } = useVoiceAssistantNLP();

  return (
    <button onClick={startListening} disabled={status === 'listening'}>
      🎤 Parler
    </button>
  );
}
```

### Étape 2: Envoyer au backend

L'hook gère automatiquement:
- Capturer audio avec MediaRecorder
- Uploader vers `/api/voice-command`
- Recevoir la réponse (intent, message, audio base64)

### Étape 3: Aficher la réponse

```typescript
const { feedback, audio_base64 } = useVoiceAssistantNLP();
// Frontend joue l'audio et affiche le message
```

### Étape 4: Confirmation (si nécessaire)

```typescript
const { confirmAction, status } = useVoiceAssistantNLP();

if (status === 'awaiting_confirmation') {
  // Afficher "Confirmer?" + boutons Oui/Non
  function onConfirm() {
    confirmAction(); // POST /api/confirm
  }
}
```

---

## 📋 Intents Supportés

| Intent | Description | Exemple | Confirmation |
|--------|-------------|---------|---------------|
| `balance` | Consulter le solde | "Quel est mon solde?" | ❌ Non |
| `transfer` | Envoyer de l'argent | "Envoie 5000 à Jean" | ✅ Oui |
| `recharge` | Recharge crédit tel | "Recharge 3000" | ✅ Oui |
| `bill_payment` | Payer facture | "Paye ma facture d'eau" | ✅ Oui |
| `help` | Afficher l'aide | "Aide" | ❌ Non |

---

## 🧪 Tests

### Exécuter la suite de tests

```bash
# Tous les tests
pytest test_integration.py -v

# Tests spécifiques
pytest test_integration.py::test_health_check -v
pytest test_integration.py -k "auth" -v

# Avec coverage
pytest test_integration.py --cov=app --cov-report=html
open htmlcov/index.html
```

### Tests manuels avec cURL

```bash
# 1. Générer un token
TOKEN=$(curl -s http://localhost:8000/api/auth/token?user_id=test | jq -r '.access_token')

# 2. Envoyer une commande vocale
curl -H "Authorization: Bearer $TOKEN" \
     -F "audio_file=@test_audio.wav" \
     http://localhost:8000/api/voice-command

# 3. Confirmer une action
curl -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"transaction_id": "tx-123"}' \
     http://localhost:8000/api/confirm
```

---

## 📊 Monitoring & Metrics

### Health Check

```bash
curl http://localhost:8000/api/health
# Response: 200 OK + cache size + features list
```

### Vérifier les transactions en attente

```bash
curl http://localhost:8000/api/pending-transactions
```

### Rate Limiting

Headers de réponse:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1711270800
```

Si limit dépassé → `429 Too Many Requests`

---

## 🛠️ Configuration Avancée

### Base de Données PostgreSQL

```bash
# Dans .env
USE_POSTGRES=true
DATABASE_URL=postgresql://user:password@localhost/voice_momo

# Lancer le service
python -m app.main
# Les transactions seront persistées dans PostgreSQL
```

### Logging

```bash
# Dans .env
LOG_LEVEL=DEBUG  # INFO, DEBUG, WARNING, ERROR
LOG_FORMAT=json  # json ou text

# Actualiser le service
```

### Rate Limiting Custom

```bash
# Dans .env
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_USER_PER_MINUTE=50
```

---

## 🔗 Endpoints Disponibles

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/docs` | ❌ | Swagger UI interactif |
| GET | `/redoc` | ❌ | ReDoc documentation |
| GET | `/health` | ❌ | Basic health check |
| POST | `/api/auth/token` | ❌ | Générer token JWT |
| GET | `/api/health` | ❌ | API health + cache |
| POST | `/api/voice-command` | ✅ | Traiter commande vocale |
| POST | `/api/confirm` | ✅ | Confirmer action |
| POST | `/api/cancel` | ✅ | Annuler action |
| GET | `/api/pending-transactions` | ✅ | Lister transactions en attente |

---

## 🚨 Dépannage

### Erreur: "Gemini API key missing"

```bash
# Vérifier que GEMINI_API_KEY est défini dans .env
echo $GEMINI_API_KEY
```

### Erreur: "Rate limit exceeded (429)"

Attendez 60 secondes avant de réessayer, ou augmentez les limites dans `.env`.

### Erreur: "psycopg2 not installed"

```bash
# Ajouter PostgreSQL à l'installation
pip install psycopg2-binary
```

### Audio ne joue pas sur le frontend

- Vérifier le CORS: `allow_origins` dans main.py
- Vérifier les permissions microphone du navigateur
- Vérifier que `audio_base64` est présent dans la réponse

---

## 📚 Documentation Complète

- **[Architecture Guide](./ACTION_EXECUTION_ARCHITECTURE.md)** - Schémas et flux détaillés
- **[Swagger Interactif](http://localhost:8000/docs)** - Tester les endpoints
- **[ReDoc](http://localhost:8000/redoc)** - Référence API lisible

---

## 🤝 Contribution

Pull requests bienvenues! Pour les changements majeurs:

1. Créer une branche feature: `git checkout -b feature/ma-feature`
2. Commit les changements: `git commit -am 'Add ma-feature'`
3. Push vers la branche: `git push origin feature/ma-feature`
4. Ouvrir une Pull Request

---

## 📞 Support

- Issues: [GitHub Issues](https://github.com/satignon/VoiceMomo/issues)
- Email: support@voicemomo.dev
- Slack: [VoiceMomo Community](https://join.slack.com/...)

---

## 📄 License

MIT License - voir [LICENSE](./LICENSE) pour les détails

---

## 🎯 Roadmap

- [ ] Intégration OAuth2 pour authentification production
- [ ] Support multi-langues (en, es, ar, sw, etc.)
- [ ] Cache distribué avec Redis
- [ ] Webhooks pour notifications
- [ ] Analytics & BI dashboard
- [ ] Mobile Money backend integration
- [ ] Transactions audio avec streaming

---

**Fait avec ❤️ pour les services financiers en Afrique**
