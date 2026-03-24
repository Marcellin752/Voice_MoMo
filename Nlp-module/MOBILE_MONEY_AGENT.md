# Integration du Mobile Money Agent LiveKit

## Architecture

```
┌─────────────────┐
│   Utilisateur   │
│  (Micro/HP)     │
└────────┬────────┘
         │ Audio
         ▼
┌─────────────────────────┐
│     LiveKit Server      │
│  (Real-time comm)       │
└────────┬────────────────┘
         │
    ┌────┴────────────┬──────────────────┐
    │                 │                  │
    ▼                 ▼                  ▼
 Deepgram         Grok NLP         ElevenLabs
 (Speech→Text)    (Analysis)       (Text→Speech)
 (Français)       (Intent)         (Voix naturelle)
    │                 │                  │
    └────────┬────────┴──────────────────┘
             │
             ▼
    ┌──────────────────────┐
    │  Mobile Money Agent  │
    │  (app/mobile_money_agent.py)  │
    └────────┬─────────────┘
             │
             ▼
    ┌──────────────────────┐
    │   Backend Actions    │
    │  (Solde, Transfert,  │
    │   Recharge, etc)     │
    └──────────────────────┘
```

## Configuration Requise

### 1. Clés API

Tu as besoin de :

- **XAI_API_KEY** : Grok (tu as déjà ✅)
- **DEEPGRAM_API_KEY** : Speech-to-Text
- **LIVEKIT_URL** : Serveur LiveKit  
- **LIVEKIT_API_KEY, LIVEKIT_API_SECRET** : Identifiants LiveKit
- **ELEVENLABS_API_KEY** (optionnel) : Voix naturelles

### 2. Où obtenir les clés

**Deepgram** (STT gratuit) :
- https://console.deepgram.com → Create API key
- Copy la key dans `DEEPGRAM_API_KEY`

**ElevenLabs** (TTS voix naturelles) :
- https://elevenlabs.io → Sign up
- Account → API Keys
- Copy la key dans `ELEVENLABS_API_KEY`

**LiveKit** (Server vocal) :
- **Option A (Cloud)** : https://cloud.livekit.io
  - Create Account → Get URL + Keys
  - Ajoute à .env
  
- **Option B (Local)** : Lancer LiveKit localement
  ```bash
  docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
    livekit/livekit-server --dev --bind localhost
  ```
  Alors: `LIVEKIT_URL=ws://localhost:7880`

### 3. Configuration du .env

Copie `.env.voice.example` en `.env` et remplis :

```bash
cp .env.voice.example .env

# Puis édite .env :
XAI_API_KEY=ta-clé-grok
DEEPGRAM_API_KEY=ta-clé-deepgram
ELEVENLABS_API_KEY=ta-clé-elevenlabs
LIVEKIT_URL=ta-url-livekit
LIVEKIT_API_KEY=ta-clé-livekit
LIVEKIT_API_SECRET=ton-secret-livekit
```

## Installation des Dépendances

```bash
cd Nlp-module
pip install -r requirements.txt
```

## Lancement

### Option 1 : Utiliser le script

```bash
cd Nlp-module
bash run_mobile_money_agent.sh
```

### Option 2 : Commande directe

```bash
cd Nlp-module
python -m livekit.agents dev app.mobile_money_agent
```

Output attendu :
```
✅ Agent Mobile Money démarré et prêt !
Launching agent dev server on ws://localhost:8081
```

## Utilisation

1. **Ouvre le client web** : http://localhost:8081
2. **Connecte-toi à une room** : Par exemple `voice-momo`
3. **Active le micro** et parle à l'agent :
   ```
   USER: "Quel est mon solde ?"
   AGENT: "Votre solde est de 50000 francs CFA"
   
   USER: "Envoie 5000 à Jean"
   AGENT: "Transfert de 5000 francs à Jean effectué"
   
   USER: "Recharge 2000"
   AGENT: "Recharge de 2000 francs effectuée"
   ```

## Features

✅ **Commandes supportées** :
- `check_balance` : "Quel est mon solde ?"
- `transfer_money` : "Envoie [montant] à [destinataire]"
- `buy_credit` : "Recharge [montant]"
- `pay_bill` : "Paye ma facture de [montant]"
- `help` : "Aide" / "Aide-moi"

✅ **Langues** : Français (fr)

✅ **NLP** : Grok analyse les intentions + extraction d'entités

✅ **Backend** : Simulation du solde, transferts, etc.

## Troubleshooting

### "ModuleNotFoundError: No module named 'livekit.plugins.deepgram'"

```bash
pip install livekit-agents-deepgram --upgrade
```

### "DEEPGRAM_API_KEY not found"

Le serveur utilise une key par défaut. Ajoute ta key dans `.env` pour utiliser ton quota.

### "LIVEKIT_URL connection failed"

- Vérifie que le serveur LiveKit tourne
- Si cloud, check que l'URL est correcte (commence par `wss://`)
- Si local Docker, assure-toi qu'il tourne : `docker ps`

### "Agent not responding to voice"

1. Check les logs : `tail -f /tmp/agent.log`
2. Vérifie que le mic est activé dans le navigateur
3. Relance l'agent : Ctrl+C + relance le script

## Prochaines Étapes

- [ ] Intégrer un vrai backend (remplacer les mocks)
- [ ] Ajouter persistance utilisateur (base de données)
- [ ] Ajouter confirmation pour transferts élevés
- [ ] Mesurer WER (Word Error Rate) en production
- [ ] Déployer sur serveur production LiveKit

## Fichiers

- `app/mobile_money_agent.py` : Agent principal
- `run_mobile_money_agent.sh` : Script de lancement
- `.env.voice.example` : Template de configuration
- `requirements.txt` : Dépendances Python
