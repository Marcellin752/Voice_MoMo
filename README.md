# 🎤 Voice MoMo — Mobile Money par Commandes Vocales

**Application de transfert d'argent vocale pour Bénin**

![Status](https://img.shields.io/badge/Status-MVP%20In%20Progress-orange)
![Platform](https://img.shields.io/badge/Platform-Android-brightgreen)
![Language](https://img.shields.io/badge/Language-French-blue)

---

## 📖 Documentation Principale

👉 **[CAHIER_DES_CHARGES.md](./docs/CAHIER_DES_CHARGES.md)** — *Lire en premier*
- Vue complète du projet
- Fonctionnalités détaillées
- Architecture technique
- Codes USSD Bénin
- Préfixes des réseaux

👉 **[LAUNCH_GUIDE.md](./docs/LAUNCH_GUIDE.md)** — *Pour lancer localement*
- Setup environnement
- Lancer l'app
- Scripts de test

👉 **[BUILD_APK.md](./docs/BUILD_APK.md)** — *Compiler l'APK Android*
- Build local (`scripts/build-apk.sh`)
- Ou APK automatique via GitHub Actions / Releases

> **Monorepo :** le code est dans `apps/mobile`, `apps/backend`, `apps/nlp`. Les anciens dossiers `Mobile/`, `Backend/`, `NLP/` à la racine n'existent plus — faire `git pull` et supprimer ces dossiers s'ils restent en local.

---

## 🚀 Fonctionnalités (MVP)

### ✅ Implémentées

| Feature | Statut | Notes |
|---------|--------|-------|
| **Transfert MTN→MTN** | ✅ | Code USSD direct |
| **Transfert MTN→Moov/Celtis** | ✅ | Via Linka Send |
| **Consultation solde** | ✅ | SMS puis USSD live |
| **Reconnaissance vocale FR** | ✅ | Google Cloud Speech API |
| **Gestion contacts** | ✅ | Avec suggestions proches |
| **Confirmation vocale** | ✅ | Text-to-Speech |
| **Auto-retry SR** | ✅ | Max 1 tentative |
| **Annulation transactions** | ✅ | Bouton + commande vocale |

### 🟡 Planifiées (Phase 2)

- Authentification biométrique
- Paiement de factures
- Achat de crédit/forfaits
- Transactions programmées
- Multilinguisme

---

## 🏗️ Structure du Projet

```
Voice_MoMo/
├── apps/
│   ├── mobile/                   # App React + Capacitor (TypeScript)
│   │   ├── src/app/
│   │   │   ├── services/
│   │   │   │   ├── engine/
│   │   │   │   │   ├── NetworkDetector.ts          # Détection réseau MTN/Moov/Celtis
│   │   │   │   │   ├── VoiceIntentProcessor.ts     # Pipeline de transfert
│   │   │   │   │   └── ContactResolverService.ts   # Résolution contacts (device)
│   │   │   │   ├── ussd_engine/
│   │   │   │   │   ├── MoMoTransactionEngine.ts     # Exécution USSD
│   │   │   │   │   └── InterNetworkTransferEngine.ts # Logique inter-réseau
│   │   │   │   └── sms.service.ts                   # Lecture SMS solde
│   │   │   ├── hooks/
│   │   │   │   ├── useVoiceAssistant.ts            # SR natif + fallback Web
│   │   │   │   └── useVoiceAssistantNLP.ts         # Pipeline complet NLP
│   │   │   └── components/
│   │   │       └── ContactDisambiguationModal.tsx  # Modale de désambiguïsation
│   │   └── android/              # Projet Android (Capacitor)
│   ├── backend/                  # API Node.js / TypeScript (Express + USSD v1)
│   │   ├── src/                  # API active (HTTP + WebSocket + queue)
│   │   └── legacy/               # Routes legacy encore montées par src/index.ts
│   └── nlp/                      # Module NLP — FastAPI (Python) — déployé sur Render
│       ├── app/action_executor.py # Exécution des intentions (Gemini)
│       └── tests/                # Smoke-test du pipeline vocal
├── docs/                         # Documentation projet (+ docs/nlp/)
│   ├── CAHIER_DES_CHARGES.md     # 👈 Vue complète du projet
│   └── LAUNCH_GUIDE.md           # Instructions de lancement
├── render.yaml                   # Déploiement Render (rootDir: apps/backend, apps/nlp)
└── README.md                     # Ce fichier
```

---

## 🔧 Technologies

### Frontend
- **React + Vite** (TypeScript)
- **Capacitor** pour accès aux plugins natifs Android

### Backend
- **Node.js + TypeScript** (Express, HTTP + WebSocket, USSD v1)
- **PostgreSQL** via Prisma + **Redis/BullMQ** pour la file de jobs

### NLP
- **Google Cloud Speech-to-Text**
- **Google Gemini 2.0 Flash** pour compréhension
- **Google Cloud Text-to-Speech** pour réponses

### Plugins Android
- `@capacitor-community/speech-recognition` — SR natif
- `@capacitor-community/text-to-speech` — TTS
- `@capacitor-community/contacts` — Accès contacts
- `cordova-plugin-sms-receive` — Lecture SMS
- Plugins custom pour USSD

---

## 📱 Codes USSD Bénin

### Transfert MTN→MTN (Direct)
```
*880*1*1*{RECIPIENT}*{RECIPIENT}*{AMOUNT}#
```

### Transfert Inter-réseau via Linka
```
*601*16*{RECIPIENT}*{NETWORK_CODE}*{AMOUNT}#
Network codes: 1=MTN, 2=Moov, 3=Celtis
```

### Consultation Solde (Live)
```
*880*4*{PIN}#
```

### Détection Réseau
```
01{prefix} où prefix:
- MTN: 42, 46, 50-54, 56-57, 59, 61-62, 66-67, 69, 90-91, 96-97
- Moov: 45, 55, 58, 60, 63-65, 68, 94-95, 98-99
- Celtis: 20-24, 28-29, 40-41, 43-44, 47-49, 92-93
```

---

## 🧪 Tester l'App

### Scénario 1 : Transfert MTN→MTN
```
Utilisateur: "Envoie 5000 à Jean"
App: "Transférer 5000 francs à Jean ?"
Utilisateur: "Oui"
→ Affiche modale PIN
→ Lance USSD *880*1*1*01...#
```

### Scénario 2 : Transfert MTN→Moov
```
Utilisateur: "Envoie 5000 à Pierre"  (contact Moov)
App: "Transférer 5000 francs à Pierre via Linka Send ?"
Utilisateur: "Oui"
→ Lance USSD *601*16*01...#
```

### Scénario 3 : Consultation Solde
```
Utilisateur: "Quel est mon solde ?"
App: "Vérification via SMS... (gratuit)"
→ Affiche solde du dernier SMS reçu
Si SMS non trouvé:
→ Demande PIN
→ Lance USSD *880*4*PIN#
```

---

## 📋 Équipe

- **Backend & USSD** : Marcellin Sambieni, AGANI Laurince
- **NLP & IA** : Fresnel Satignon
- **Mobile Frontend** : [À définir]

---

## 📞 Support

Pour questions ou issues:
1. Consulter [CAHIER_DES_CHARGES.md](./docs/CAHIER_DES_CHARGES.md)
2. Consulter [LAUNCH_GUIDE.md](./docs/LAUNCH_GUIDE.md)
3. Vérifier les logs (surtout `[NETWORK]`, `[INTER-NETWORK]`, `[ENGINE]`)

---

## 📄 Licence

Projet Bénin - MTN MoMo Integration

---

**Dernière mise à jour:** 2026-06-16
