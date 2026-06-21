# 📋 CAHIER DES CHARGES COMPLET
**Application Mobile Money - Commandes Vocales en Français**

**Dernière mise à jour:** 2026-06-21 | **Version:** 1.2

---

## 1. Contexte et Objectif du Projet

Développer une application mobile permettant d'effectuer des transactions Mobile Money **uniquement à l'aide de commandes vocales en français**.

### Objectifs :
- 🎯 Simplifier l'utilisation du Mobile Money
- 🎯 Faciliter l'accès aux services financiers pour personnes peu à l'aise avec le numérique
- 🎯 Réduire les erreurs liées à la saisie manuelle
- 🎯 Offrir une interaction naturelle et intuitive

---

## 2. Utilisateurs Cibles

- Utilisateurs Mobile Money classiques
- Personnes ayant des difficultés avec les interfaces numériques
- Personnes âgées
- Utilisateurs souhaitant une interaction rapide et naturelle

---

## 3. Plateforme

- 🔴 **Android** (prioritaire) - **EN DÉVELOPPEMENT**
- 🟡 **iOS** (optionnel phase 2)

---

## 4. Fonctionnalités Essentielles (MVP)

### 4.1 Authentification
- ✅ Connexion par numéro MTN + code OTP (6 chiffres, SMS)
- ✅ Session timeout (5 min d'inactivité → déconnexion automatique)
- 🟡 Authentification biométrique (phase 2)

> Le PIN MTN (4 chiffres) n'est **pas** utilisé à la connexion : il est dicté **à la voix** uniquement lors des opérations USSD (transfert, solde live).

### 4.2 Interaction Vocale
- ✅ Activation du microphone
- ✅ Commandes en français naturel
- ✅ Retour vocal des résultats
- ✅ Messages d'erreur humanisés

**Exemples de commandes :**
```
"Envoie 5000 francs à Jean"
"Quel est mon solde ?"
"Achète 2000 francs de crédit"
"Annule" (pour stopper une transaction)
```

### 4.3 Conversions Voix ↔ Texte
- ✅ Capture audio via microphone (Capacitor / WebRTC)
- ✅ Speech-to-Text + NLP via **Gemini** (`apps/nlp`)
- ✅ Text-to-Speech pour réponses vocales (Capacitor TTS)
- ✅ Support du français avec tolérance aux accents

### 4.4 Compréhension de l'Intention (NLP)
- ✅ Extraction d'entités (montant, destinataire, action)
- ✅ Détection d'ambiguïtés
- ✅ Suggestions de contacts proches
- 🟡 Support des variantes linguistiques

### 4.5 Exécution des Transactions

#### ✅ TRANSFERT D'ARGENT
- **MTN → MTN** : Direct via USSD `*880*1*1*...#`
- **MTN → Moov/Celtis** : Via Linka Send `*601*16*...#`
- Confirmation vocale avant exécution
- Auto-détection du réseau du bénéficiaire

#### ✅ CONSULTATION DE SOLDE
- **SMS d'abord** : Lecture gratuite des SMS (fraîcheur : 60 min)
- **USSD live** : Sur commande vocale « quel est mon solde » (PIN dicté à la voix)
- Mise à jour automatique après chaque transaction

#### ✅ ACHAT DE CRÉDIT / FORFAITS (MVP vocal)
- Recharge airtime, forfaits internet, Go Pack — via menu USSD `*880#` (commande vocale)

#### ✅ RETRAIT & PAIEMENT DE FACTURES (MVP vocal)
- Retrait agent / GAB et factures (électricité, eau, internet) — ouverture menu USSD par la voix

### 4.6 Sécurité
- ✅ Chiffrement HTTPS
- ✅ Authentification par PIN/Biométrie
- ✅ Confirmation vocale des transactions sensibles
- ✅ Détection d'anomalies basique
- ✅ Journalisation des opérations
- ✅ Gestion des erreurs avec messages clairs

### 4.7 Performance
- ⏱️ Compréhension d'une commande : < 3 secondes
- ⏱️ Exécution transactions : temps réel
- ⏱️ Support connexion internet standard

---

## 5. Intégration Mobile Money

### Opérateurs supportés (Phase 1)
- ✅ **MTN Bénin** : Codes USSD éprouvés
- ✅ **Moov Bénin** : Via Linka Send
- ✅ **Celtis Bénin** : Via Linka Send

### Codes USSD Bénin 2024

#### MTN Direct (Même réseau)
```
*880*1*1*{recipient_number}*{recipient_number}*{amount}#
```

#### Inter-réseau via Linka Send
```
*601*16*{recipient_number}*{network_code}*{amount}#
  où network_code : 1=MTN, 2=Moov, 3=Celtis
```

#### Consultation Solde
```
*880*4*{pin}#  (USSD live, avec PIN)
```

### Détection de Réseau par Préfixes

Tous les numéros Bénin = 01 + {2 chiffres distinctifs}

| Réseau | Préfixes après 01 |
|--------|-------------------|
| **MTN** | 42, 46, 50, 51, 52, 53, 54, 56, 57, 59, 61, 62, 66, 67, 69, 90, 91, 96, 97 |
| **Moov** | 45, 55, 58, 60, 63, 64, 65, 68, 94, 95, 98, 99 |
| **Celtis** | 20, 21, 22, 23, 24, 28, 29, 40, 41, 43, 44, 47, 48, 49, 92, 93 |

---

## 6. Architecture Technique

### Stack Choisi

**Frontend Mobile :**
- Framework : **React + Vite + Capacitor** (`apps/mobile`)
- Langage : TypeScript
- UI : opérations financières **100 % vocales** (pas de formulaires de transaction)

**Backend API :**
- Framework : **Node.js / Express** (`apps/backend`)
- Base de données : PostgreSQL
- Authentification : JWT

**Module NLP :**
- **FastAPI** (`apps/nlp`) + **Gemini** pour STT + compréhension des intentions

**Infrastructure :**
- CI/CD : GitHub Actions (build APK)
- Hosting backend : Render
- Déploiement NLP : Render / service dédié

---

## 7. Statut des Fonctionnalités

### Phase 1 : MVP (✅ EN COURS)

| Fonctionnalité | Statut | Dernière MAJ |
|---|---|---|
| **Authentification OTP** | ✅ Complète | 2026-06-21 |
| **Session timeout 5 min** | ✅ Complète | 2026-06-21 |
| **Reconnaissance vocale** | ✅ Complète | 2026-06-14 |
| **NLP (Gemini)** | ✅ Complète | 2026-06-14 |
| **Transfert MTN→MTN** | ✅ Complète | 2026-06-14 |
| **Transfert inter-réseau** | ✅ Complète | 2026-06-16 |
| **Consultation solde** | ✅ Complète | 2026-06-21 |
| **Recharge / forfaits (vocal)** | ✅ Complète | 2026-06-21 |
| **Retrait / factures (vocal)** | ✅ Complète | 2026-06-21 |
| **Confirmation vocale (oui/non)** | ✅ Complète | 2026-06-21 |
| **PIN dicté à la voix** | ✅ Complète | 2026-06-21 |
| **Désambiguïsation contacts (vocal)** | ✅ Complète | 2026-06-21 |
| **Gestion contacts** | ✅ Complète | 2026-06-14 |
| **Auto-retry après erreur SR** | ✅ Complète | 2026-06-12 |
| **Annulation transactions** | ✅ Complète | 2026-06-12 |
| **Balance freshness (SMS)** | ✅ Complète | 2026-06-12 |

### Phase 2 : Avancée (🟡 PLANIFIÉE)

| Fonctionnalité | Priorité | Estimé |
|---|---|---|
| Authentification biométrique | Haute | 2-3j |
| Transactions programmées | Basse | 3-4j |
| Mode hors ligne partiel | Basse | 2j |
| Multilinguisme (Fon, Yoruba) | Basse | 4-5j |
| iOS | Moyenne | 1-2 sem |

---

## 8. Exigences Non-Fonctionnelles

### Sécurité
- ✅ Connexion HTTPS systématique
- ✅ Stockage sécurisé du PIN
- ✅ Gestion des sessions (timeout)
- ✅ Logging des opérations sensibles

### Performance
- ✅ Temps de réponse < 3s pour compréhension
- ✅ Support des appareils Android 8+
- ✅ Optimisation batterie
- ✅ Gestion données minimale (cache local)

### Accessibilité
- ✅ Interface minimaliste (navigation + affichage)
- ✅ Retours vocaux clairs
- ✅ Gestion d'erreurs explicite
- ✅ **Aucune saisie tactile** pour transferts, PIN, confirmation ou choix de contact

---

## 9. Livrables

- ✅ Application Android fonctionnelle
- ✅ Backend API documentée
- ✅ Module NLP opérationnel
- ✅ Documentation technique (ce document)
- 🟡 Documentation utilisateur
- 🟡 Tests automatisés
- 🟡 Déploiement en version beta

---

## 10. Évolutions Futures (Phase 3+)

- Support iOS
- Assistant vocal proactif (alertes, rappels)
- Intégration services financiers additionnels
- Analyse de dépenses / budgeting
- Partage de frais
- Marché intra-app pour services

---

## 11. Contraintes et Limitations

### Actuelles (Phase 1)
- 🔴 Français uniquement (multilangue: Phase 3)
- 🔴 Android uniquement
- 🔴 Connexion internet obligatoire (NLP cloud)
- 🔴 PIN MTN dicté à la voix pour opérations USSD sensibles

### À adresser
- Quota Gemini API (rate limiting, fallback)
- Précision SR avec accents forts
- Variantes linguistiques locales

---

## 12. Logs et Debugging

### Logs importants

**NetworkDetector.ts**
```
🔍 [NETWORK] Détection - Numéro: 0160000001, Prefix: 60
✅ [NETWORK] Réseau: MOOV
```

**InterNetworkTransferEngine.ts**
```
🔨 [INTER-NETWORK] Construction code USSD - Montant: 5000 XOF
✅ [INTER-NETWORK] MTN→Moov (Linka): *601*16*0160000001*2*5000#
```

**MoMoTransactionEngine.ts**
```
⚙️ [ENGINE] [TRANSFER] Service: Linka Send
⚙️ [ENGINE] [TRANSFER] USSD Final String: *601*16*0160000001*2*5000#
```

---

## 13. Contact & Support

- **Lead Backend** : Marcellin Sambieni
- **Lead Frontend** : [À définir]
- **Lead NLP** : Fresnel Satignon
- **Documentation** : Ce document (à jour)

---

**Fin du Cahier des Charges**
