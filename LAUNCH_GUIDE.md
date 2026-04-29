# Guide de Lancement : Voice MoMo (Local & Mobile)

Ce guide détaille les étapes pour faire fonctionner le projet complet sur votre ordinateur et tester l'application sur votre téléphone.

**Architecture actuelle** :
- **Backend** (Node.js) : API principale + MMI/USSD sur port 3001
- **NLP Module** (Python/FastAPI) : IA vocale (STT/NLU/TTS) avec Gemini 2.0 Flash sur port 8000
- **Mobile** (React/Vite) : Frontend sur port 5173

---

## 1. Préparation (PC)

### Trouver votre adresse IP locale
Pour que votre téléphone puisse communiquer avec votre PC, vous devez connaître l'adresse IP de votre PC sur le réseau Wi-Fi.
- **Linux/Mac** : `hostname -I` ou `ifconfig`
- **Windows** : `ipconfig`
- *Ton IP : `192.168.100.35`*

### Configuration des fichiers .env

#### Mobile/.env
```env
# Backend API (Voice MoMo)
VITE_API_BASE_URL=http://192.168.100.35:3001

# NLP Module (Voice AI) - Pointe vers le nouveau service FastAPI
VITE_VOICE_AI_URL=http://192.168.100.35:8000
```

#### Nlp-module/.env
Copiez et modifiez le fichier `.env.example` :
```bash
cd Nlp-module
cp .env.example .env
```

Remplissez les variables essentielles :
```env
# Clé API Google Gemini (obligatoire)
GEMINI_API_KEY= votre-cle-api-gemini-ici

# Configuration JWT (développement)
JWT_SECRET=dev-secret-key-change-in-production

# Base de données (désactivée en dev)
USE_POSTGRES=false

# Port du service
NLP_API_PORT=8000
```

> **Obtenir une clé Gemini** : https://aistudio.google.com/app/apikey

---

## 2. Installation du NLP Module (Nouveau)

Le NLP Module remplace l'ancien `ai-service`. Il utilise FastAPI et Gemini 2.0 Flash pour le traitement vocal.

### Prérequis Python
```bash
cd Nlp-module

# Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou : venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt
```

### Librairies système (Linux)
```bash
# Si erreur PortAudio lors des tests locaux
sudo apt-get update
sudo apt-get install -y portaudio19-dev libportaudio2 ffmpeg
```

---

## 3. Lancement des Services (PC)

Ouvrez **4 terminaux** différents :

### Terminal 1 : Redis (File d'attente)
```bash
cd Backend
npm run dev:redis
```

### Terminal 2 : Backend API (Port 3001)
```bash
cd Backend
npm run dev
```

### Terminal 3 : Backend Worker (USSD/MMI)
```bash
cd Backend
npm run dev:worker
```

### Terminal 4 : NLP Module - IA Vocale (Port 8000)
```bash
cd Nlp-module
source venv/bin/activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Vérification du NLP Module** :
```bash
# Health check
curl http://localhost:8000/api/health

# Documentation Swagger
# Ouvrez : http://localhost:8000/docs
```

---

## 4. Lancement du Frontend (PC)

### Terminal 5 : Mobile (Port 5173)
```bash
cd Mobile
npm run dev
```

Accès sur PC : `http://localhost:5173`

---

## 5. Test sur Téléphone (Android)

### Option A : Via le navigateur (Chrome sur Android)
1. Connectez votre téléphone au **même Wi-Fi** que votre PC.
2. Ouvrez Chrome et accédez à `http://192.168.100.35:5173`.

> **⚠️ Problème du Micro (Insecure Origin)** :
> Par défaut, Chrome bloque le microphone sur les sites non-HTTPS.
> **Solution** :
> 1. Dans Chrome sur votre téléphone, tapez : `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
> 2. Activez l'option (**Enabled**).
> 3. Dans la zone de texte, ajoutez votre URL : `http://192.168.100.35:5173`
> 4. Relancez Chrome.

### Option B : Via l'APK Native (Recommandé pour la voix)
Le micro fonctionne nativement sans restriction HTTPS et utilise les plugins Capacitor.

1. Installez Android Studio.
2. Branchez votre téléphone en mode USB Debugging.
3. Exécutez :
```bash
cd Mobile
npm run build
npx cap copy android
npx cap open android
```
4. Dans Android Studio, cliquez sur "Run" (bouton Play vert).

---

## 6. Test du Pipeline Vocal

Un script de test complet est disponible à la racine du projet :

```bash
# Tester tout le pipeline (depuis la racine du projet)
python3 test_voice_pipeline.py
```

Ce script vérifie :
- Connexion au NLP Module
- Authentification JWT
- Upload audio et parsing
- Confirmation de transaction
- Synthèse vocale (TTS)

---

## 7. Résolution des problèmes fréquents

| Problème | Solution |
|----------|----------|
| **Le micro ne répond pas** | Vérifiez que `VITE_VOICE_AI_URL` utilise bien votre IP locale et non `localhost` dans `Mobile/.env` |
| **Erreur "Gemini API key missing"** | Vérifiez que `GEMINI_API_KEY` est défini dans `Nlp-module/.env` |
| **NLP Module ne démarre pas** | Vérifiez que le port 8000 n'est pas déjà utilisé : `lsof -i :8000` |
| **CORS error** | Le NLP Module autorise toutes les origines par défaut. Vérifiez le démarrage du serveur |
| **Transactions bloquées** | Vérifiez que le `Backend worker` est bien lancé dans son terminal dédié |
| **Port déjà utilisé** | Si un service ne se lance pas, vérifiez les ports 3001, 8000, 5173 |

### Commandes de debug

```bash
# Vérifier si les services tournent
curl http://localhost:3001/health           # Backend (legacy)
curl http://localhost:8000/api/health     # NLP Module

# Générer un token JWT de test
curl "http://localhost:8000/api/auth/token?user_id=test_user"

# Tester avec un fichier audio
curl -X POST "http://localhost:8000/api/voice-command" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio_file=@test_audio.wav"
```

---

## 8. Architecture des Services

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│    Mobile       │      │   Backend API    │      │  NLP Module     │
│   (React)       │──────▶│   (Node.js)      │      │  (Python/Fast)  │
│   Port 5173     │      │   Port 3001      │      │  Port 8000      │
└─────────────────┘      └──────────────────┘      └────────┬────────┘
        │                                                  │
        │                                                  ▼
        │                                         ┌─────────────────┐
        │                                         │  Gemini 2.0     │
        │                                         │  Flash (STT/    │
        │                                         │  NLU/TTS)        │
        │                                         └─────────────────┘
        ▼
┌─────────────────┐
│  Microphone /   │
│  Haut-parleur   │
└─────────────────┘
```

**Flux vocal** :
1. Mobile capture l'audio (micro)
2. Upload vers NLP Module (`POST /api/voice-command`)
3. NLP Module transcode l'audio → Gemini 2.0 Flash
4. Gemini analyse (STT → NLU → Action → TTS)
5. Réponse JSON + audio base64 retournée au Mobile
6. Mobile joue la réponse vocale
