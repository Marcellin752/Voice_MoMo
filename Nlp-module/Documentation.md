# Module IA/NLP - Voice MoMo

Ce module contient uniquement la logique IA/NLP pour interpreter des commandes vocales Mobile Money en francais.

## Ce qui a ete implemente
- Service HTTP FastAPI pour parser les commandes vocales en texte.
- Integration Grok (xAI) pour l'analyse d'intention et extraction d'entites.
- Fallback local (regex) si Grok est indisponible, timeout, ou erreur externe.
- Contrat de sortie structure pour faciliter l'orchestration backend.
- Confirmation automatique exigee pour les intentions sensibles.

## Cas couverts (MVP)
- Consultation de solde
- Transfert d'argent
- Recharge credit
- Paiement facture (eau/electricite/internet)
- Aide utilisateur
- Confirmation/annulation (oui/non)

## Architecture rapide
- Entree: transcription texte STT
- Traitement:
  1. Grok parse intent + entities
  2. Validation/normalisation locale
  3. Fallback regex en cas d'echec provider
- Sortie: JSON standardise

## Variables d'environnement
Copier `.env.example` vers `.env`:
- `XAI_API_KEY`: cle Grok
- `XAI_BASE_URL`: par defaut `https://api.x.ai/v1`
- `XAI_MODEL`: par defaut `grok-2-latest`
- `REQUEST_TIMEOUT_SECONDS`: timeout HTTP sortant vers Grok

## Installation et execution
```bash
cd Nlp-module
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## Endpoints
### GET /health
Reponse:
```json
{
  "status": "ok"
}
```

### POST /ai/parse
Request:
```json
{
  "text": "Envoie 5000 francs a Jean",
  "locale": "fr-FR"
}
```

Response:
```json
{
  "intent": "transfer",
  "amount": 5000,
  "currency": "XOF",
  "recipient": "Jean",
  "bill_type": null,
  "needs_confirmation": true,
  "confirmation_message": "Voulez-vous envoyer 5000 francs a Jean ?",
  "understood_text": "Envoie 5000 francs a Jean",
  "metadata": {
    "provider": "grok",
    "model": "grok-2-latest",
    "confidence": 0.91,
    "raw_output": "..."
  }
}
```

## Intents supportes
- `balance`
- `transfer`
- `recharge`
- `bill_payment`
- `help`
- `confirm`
- `cancel`
- `unknown`

## Regles de securite fonctionnelle
- Pour `transfer`, `recharge`, `bill_payment`: `needs_confirmation` est force a `true`.
- Le backend ne doit jamais executer une transaction sensible sans confirmation explicite utilisateur.

## Qualite de service
- Si Grok echoue, le fallback local reste operationnel.
- Le champ `metadata.provider` indique la source (`grok` ou `fallback`).
- Le champ `metadata.confidence` permet d'appliquer des politiques backend (clarification, rephrase, etc.).

## Fichiers principaux
- `app/main.py`: API HTTP
- `app/service.py`: orchestration parse + fallback
- `app/grok_client.py`: appel provider Grok
- `app/fallback.py`: parser local
- `app/models.py`: schema de donnees
- `app/config.py`: configuration env

## Tests rapides manuels
Exemples a verifier:
- "Quel est mon solde ?" -> `balance`
- "Envoie 5000 a Jean" -> `transfer` + amount + recipient + confirmation
- "Recharge 2000" -> `recharge` + amount + confirmation
- "Paye facture internet 3500" -> `bill_payment` + bill_type + confirmation
- "Oui" -> `confirm`
- "Non" -> `cancel`

## Documentation integration backend
Voir aussi:
- `../Backend/AI_API_Contract.md`
- `../Backend/AI_Backend_Integration_Guide.md`

## Mode Voix Temps Reel (Grok uniquement, sans Google)

Ce mode reproduit l'approche de `softride`:
- xAI/Grok gere la voix temps reel
- Le modele comprend la demande
- Le modele appelle des fonctions backend

### Fichier principal
- `app/voice_agent.py`

### Variables a configurer
1. Copier `.env.voice.example` vers `.env`
2. Renseigner:
   - `XAI_API_KEY`
   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `XAI_VOICE` (optionnel)
   - `BACKEND_ACTION_URL` (optionnel, sinon simulation)

### Lancer le mode voix
```bash
cd Nlp-module
bash run_voice_agent.sh
```

Important: `run_voice_agent.sh` lance un worker LiveKit (mode job queue).
Ce mode reste en attente tant qu'aucun participant ne rejoint la room.

Par defaut, `run_voice_agent.sh` utilise:
- `/home/mericstudent/softride/.venv/bin/python`

Ce choix est volontaire: ce venv contient deja `livekit.plugins.xai`.

Si vous avez un autre venv compatible, vous pouvez forcer:
```bash
VOICE_AGENT_PYTHON=/path/to/python bash run_voice_agent.sh
```

### Outils vocaux exposes au modele
- `consulter_solde`
- `preparer_transfert`
- `preparer_recharge`
- `preparer_paiement_facture`
- `confirmer_action`
- `annuler_action`
- `aide_commandes`

## Workflow 100% Laptop (sans navigateur)

Ce workflow ouvre 2 participants locaux dans la meme room LiveKit:
- un agent local
- un client audio micro/haut-parleur

1) Terminal A (agent):
```bash
cd Nlp-module
bash run_voice_agent_local.sh
```

Note: ce script active automatiquement `DISABLE_SSL_VERIFY=true` en local
(`VOICE_AGENT_ALLOW_INSECURE_SSL=1` par defaut) pour contourner les reseaux
avec inspection TLS. Pour desactiver ce comportement:
```bash
VOICE_AGENT_ALLOW_INSECURE_SSL=0 bash run_voice_agent_local.sh
```

2) Terminal B (micro + speaker):
```bash
cd Nlp-module
bash run_local_audio_client.sh
```

Par defaut, la room locale est `voice-momo-local`.
Vous pouvez la changer avec `LIVEKIT_ROOM`.

## Troubleshooting Linux

### 1) `OSError: PortAudio library not found`
Installez PortAudio systeme:
```bash
sudo apt-get update
sudo apt-get install -y portaudio19-dev libportaudio2
```

Puis relancez `bash run_local_audio_client.sh`.

### 2) `WSServerHandshakeError: 403` vers `wss://api.x.ai/v1/realtime`
Cela indique generalement un probleme d'autorisation sur l'API key xAI realtime (pas un probleme LiveKit).

Verifications:
- La cle `XAI_API_KEY` est valide et active pour le Realtime API.
- Le compte xAI a bien acces au modele realtime utilise par le plugin (`grok-4-1-fast-non-reasoning`).

Cas reseau entreprise/proxy TLS:
- Vous pouvez tester temporairement avec `DISABLE_SSL_VERIFY=true` dans `.env`.
- Ne laissez pas cette option en production.

### Bridge backend attendu
Si `BACKEND_ACTION_URL` est configure, le module envoie:
- `POST {BACKEND_ACTION_URL}/actions/execute`
- Body:
```json
{
  "action": "transfer",
  "payload": {
    "amount": 5000,
    "recipient": "Jean"
  }
}
```

Sinon, le module tourne en mode simulation pour tests.
