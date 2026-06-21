# Guide de Lancement : Voice MoMo (Local & Mobile)

Ce guide détaille les étapes pour faire fonctionner le projet complet sur votre ordinateur et tester l'application sur votre téléphone.

**Architecture actuelle (monorepo `apps/`)** :
- **`apps/backend`** (Node.js/Prisma) : API principale + MMI/USSD sur port **3001**
- **`apps/nlp`** (Python/FastAPI) : IA vocale (Gemini) sur port **8000**
- **`apps/mobile`** (React/Capacitor) : Application Android native

---

## 1. Préparation (PC)

### Trouver votre adresse IP locale
Pour que votre téléphone puisse communiquer avec votre PC, vous devez connaître l'adresse IP de votre PC sur le réseau Wi-Fi.
- **Linux/Mac** : `hostname -I` ou `ifconfig`
- **Windows** : `ipconfig`

### Configuration des fichiers `.env`

#### `apps/mobile/.env`
```env
VITE_API_BASE_URL=http://<VOTRE_IP_LAN>:3001
VITE_VOICE_AI_URL=http://<VOTRE_IP_LAN>:8000
```

#### `apps/nlp/.env`
```env
GEMINI_API_KEY=votre_cle_ici
JWT_SECRET=meme_secret_que_le_backend
NLP_API_PORT=8000
```

#### `apps/backend/.env`
```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/mtn_ussd
JWT_SECRET=your-256-bit-secret-change-me
SKIP_REDIS=false
REDIS_HOST=localhost
USE_MOCK_MODEM=true
```

---

## 2. Installation & Lancement

### NLP (`apps/nlp`)
```bash
cd apps/nlp
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # puis éditer GEMINI_API_KEY
python run_server.py
```

### Backend (`apps/backend`)
```bash
cd apps/backend
cp .env.example .env
npm install
npm run migrate
npm run dev          # Terminal 1 : API
npm run dev:worker   # Terminal 2 : USSD Worker (optionnel)
```

---

## 3. Build & Test Mobile (Android)

```bash
cd apps/mobile
npm install
cp .env.example .env   # adapter VITE_* avec votre IP LAN
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK : `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### Installation
1. Transférez l'APK sur votre téléphone.
2. Installez-le (autorisez les sources inconnues).
3. Connectez le téléphone au **même réseau Wi-Fi** que le PC.

---

## 4. Fonctionnalités Spécifiques (MTN Bénin)

### Codes USSD
- MTN → MTN : `*880*1*1*{tel}*{tel}*{montant}#`
- MTN → Moov/Celtis (Linka) : `*601*16*{tel}*{code}*{montant}#`
- Solde live : `*880*4*{PIN}#`

### Résolution des contacts
- **Commande** : « Envoie 5000 à Jean »
- **Action** : l'app cherche « Jean » dans les contacts Android, puis lance le bon code USSD.

---

## 5. Résolution des problèmes

| Problème | Solution |
|----------|----------|
| **Erreur de réseau** | Même Wi-Fi PC/téléphone. Vérifier `VITE_API_BASE_URL` et `VITE_VOICE_AI_URL`. |
| **Le micro ne répond pas** | Permissions micro + `VITE_VOICE_AI_URL` pointant vers le NLP. |
| **Contacts non trouvés** | Permission Contacts accordée. |
| **USSD ne se lance pas** | Téléphone physique avec SIM MTN active. |
| **Numéro utilisateur non configuré** | Se reconnecter (numéro normalisé au login). |

---

## 6. Architecture des Flux

1. **Audio** capturé par le mobile.
2. **NLP** (Gemini via FastAPI) : transcription + intention + confirmation.
3. **Mobile** : résolution contact + construction USSD + exécution sur la SIM.
4. **Backend** : auth, profil, historique (pas le chemin USSD principal).
