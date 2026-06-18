# Guide de Lancement : Voice MoMo (Local & Mobile)

Ce guide détaille les étapes pour faire fonctionner le projet complet sur votre ordinateur et tester l'application sur votre téléphone.

**Architecture actuelle** :
- **Backend** (Node.js/Prisma) : API principale + MMI/USSD sur port **3001**
- **NLP Module** (Python/FastAPI) : IA vocale (STT/NLU/TTS) avec Gemini 2.0 Flash sur port **8000**
- **Mobile** (React/Capacitor) : Application Android native

---

## 1. Préparation (PC)

### Trouver votre adresse IP locale
Pour que votre téléphone puisse communiquer avec votre PC, vous devez connaître l'adresse IP de votre PC sur le réseau Wi-Fi.
- **Linux/Mac** : `hostname -I` ou `ifconfig`
- **Windows** : `ipconfig`
- *IP configurée : `192.168.100.35`*

### Configuration des fichiers .env

#### Mobile/.env
```env
# Backend API (Voice MoMo)
VITE_API_BASE_URL=http://192.168.100.35:3001

# NLP Module (Voice AI) - IA Gemini & Traitement Vocal
VITE_VOICE_AI_URL=http://192.168.100.35:8000
```

#### Nlp-module/.env
```env
# Clé API Google Gemini (obligatoire)
GEMINI_API_KEY=votre_cle_ici

# Port du service
NLP_API_PORT=8000
```

---

## 2. Installation & Lancement

### NLP Module (Python)
```bash
cd Nlp-module
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Backend (Node.js)
```bash
cd Backend
npm install
npm run migrate # Si première installation
npm run dev     # Terminal 1 : API
npm run dev:worker # Terminal 2 : USSD Worker
```

---

## 3. Build & Test Mobile (Android)

Pour tester sur un téléphone réel avec les fonctionnalités natives (Micro, Contacts, USSD) :

### Étape 1 : Build de l'APK
```bash
cd Mobile
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
L'APK généré se trouve dans : `Mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### Étape 2 : Installation
1. Transférez `app-debug.apk` sur votre téléphone.
2. Installez-le (autorisez les sources inconnues).
3. Connectez le téléphone au **même réseau Wi-Fi** que le PC.

---

## 4. Fonctionnalités Spécifiques (MTN Bénin)

### Codes USSD réels
Le projet a été mis à jour pour utiliser les codes réels de **MTN Bénin** :
- Menu Principal : `*880#`
- Solde : `*123#`

### Résolution des contacts
L'application peut maintenant résoudre les noms de contacts.
- **Commande** : "Fait un dépôt de 2000 à Aurel"
- **Action** : L'app cherche "Aurel" dans vos contacts Android, récupère son numéro, et lance le code USSD `*880#` avec les paramètres.

### Intentions supportées
- `balance` : Consulter le solde
- `transfer` : Envoyer de l'argent
- `deposit` : Faire un dépôt (Cash-in)
- `withdraw` : Retirer de l'argent
- `recharge` : Crédit téléphonique
- `bill_payment` : Factures (SBEE, SONEB)

---

## 5. Résolution des problèmes

| Problème | Solution |
|----------|----------|
| **Erreur de réseau** | Vérifiez que le PC et le téléphone sont sur le même Wi-Fi. Vérifiez l'IP dans `Mobile/.env`. |
| **Le micro ne répond pas** | Accordez les permissions à l'application. Vérifiez `VITE_VOICE_AI_URL`. |
| **Contacts non trouvés** | Accordez la permission "Contacts" à l'application lors du premier lancement. |
| **USSD ne se lance pas** | L'application doit être installée sur un téléphone avec une carte SIM active. |

---

## 6. Architecture des Flux

1. **Audio** capture par le Mobile.
2. **Traitement NLP** par Gemini (via FastAPI) : Transcription + Intention + TTS.
3. **Action** : Si l'intention est validée, le Mobile exécute le code USSD ou appelle le Backend.
4. **USSD** : Exécution via l'application téléphone native du mobile.
