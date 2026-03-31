# AI vocal local (STT + NLU + TTS + orchestrateur)

Pipeline : **audio** → Whisper (5001) → Mistral/Ollama (5002) → backend Voice MoMo → Coqui TTS (5003) → **audio**.

## Prérequis

- **RAM** : 8 Go minimum recommandés (Whisper `large-v3` ; sinon variable `WHISPER_MODEL=medium`).
- **Python** 3.10+, **Node.js** 18+, **ffmpeg**, **Docker** (optionnel mais recommandé pour Ollama + stack).
- **Ollama** + modèle `mistral` (`ollama pull mistral`).
- Backend MoMo sur **3001** (ou définir `BACKEND_URL`).

## Installation

```bash
cd ai-service
chmod +x setup.sh
./setup.sh
```

## Démarrage Docker

```bash
cd ai-service
docker compose up --build
```

Puis, une fois Ollama démarré dans le conteneur :

```bash
docker exec -it ai-service-ollama-1 ollama pull mistral
```

(Le nom du conteneur peut varier ; utiliser `docker ps`.)

## Configuration

| Variable | Description |
|----------|-------------|
| `BACKEND_URL` | URL du backend (défaut `http://host.docker.internal:3001` dans compose) |
| `PIN_ENCRYPTION_KEY` | Même clé hex 64 chars que le backend pour chiffrer le PIN (API v1) |
| `USE_V1_USSD` | `true` pour tenter `POST /api/v1/transaction` (nécessite Redis + queue) |
| `DEFAULT_VOICE_COUNTRY` | Ex. `BJ` |
| `WHISPER_MODEL` | Surcharge du modèle faster-whisper |
| `OLLAMA_MODEL` | Modèle Ollama (défaut `mistral`) |

Contacts vocaux : éditer `data/contacts.json` (alias → numéro).

## Application mobile

Dans `Mobile/.env` (ou `.env.local`) :

```env
VITE_VOICE_AI_URL=http://192.168.x.x:5004
VITE_API_BASE_URL=http://192.168.x.x:3001
```

L’**IP doit être celle du PC** vue depuis le téléphone (même Wi‑Fi). Avec l’URL définie, le **bouton micro** sur l’accueil enregistre l’audio, l’envoie à l’orchestrateur, puis lit la réponse TTS.

Flux : premier tap = enregistrement, second tap = envoi. Pour confirmation / PIN / numéro, même principe selon le message vocal.

## Tests rapides (curl)

```bash
curl -s http://localhost:5001/health
curl -s http://localhost:5002/health
curl -s http://localhost:5003/health
curl -s http://localhost:5004/health
curl -s http://localhost:11434/api/tags
```

NLU :

```bash
curl -s -X POST http://localhost:5002/parse -H "Content-Type: application/json" -d '{"text":"quel est mon solde"}'
```

## Dépannage

- **Ollama down** : NLU renvoie `unknown` ; vérifier `ollama serve` et `ollama pull mistral`.
- **Ports occupés** : changer les mappings dans `docker-compose.yml`.
- **RAM** : réduire `WHISPER_MODEL` à `small` ou `medium`.
- **TTS lent / échec au build** : image lourde ; premier lancement télécharge les poids Coqui.
- **Docker → backend** : sous Linux, `host.docker.internal` est fourni via `extra_hosts` dans le compose.

## Ports

| Service | Port |
|---------|------|
| STT | 5001 |
| NLU | 5002 |
| TTS | 5003 |
| Orchestrateur | 5004 |
| Ollama | 11434 |
