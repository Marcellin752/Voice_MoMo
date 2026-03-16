# 📱 VoiceMoney — Documentation Frontend Flutter

> Application Mobile Money à commandes vocales en français  
> Frontend développé avec **Flutter** · Style **Moderne & Minimaliste**

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture du projet](#2-architecture-du-projet)
3. [Installation & démarrage](#3-installation--démarrage)
4. [Système de design (Design Tokens)](#4-système-de-design)
5. [Écrans — Description détaillée](#5-écrans)
6. [Widgets réutilisables](#6-widgets-réutilisables)
7. [Services : Mock vs API réel](#7-services--mock-vs-api-réel)
8. [Navigation & routes](#8-navigation--routes)
9. [Intégration vocale](#9-intégration-vocale)
10. [Checklist avant production](#10-checklist-avant-production)

---

## 1. Vue d'ensemble

VoiceMoney est une application Flutter qui permet à l'utilisateur de réaliser toutes ses opérations Mobile Money **uniquement à la voix**. Cette documentation couvre exclusivement la partie **Frontend** du projet.

### Fonctionnalités couvertes par ce frontend

| Écran | Fonctionnalité |
|---|---|
| **LoginScreen** | Saisie du numéro de téléphone |
| **PinScreen** | Authentification par code PIN (4 chiffres) |
| **HomeScreen** | Solde, bouton micro, contacts rapides, dernières transactions |
| **HistoryScreen** | Historique filtrable par type de transaction |
| **ConfirmationScreen** | Revue + confirmation vocale d'une transaction |

---

## 2. Architecture du projet

```
lib/
├── main.dart                    ← Entrée de l'app + configuration des routes
│
├── theme/
│   └── app_theme.dart          ← Design tokens (couleurs, espacements, rayons, typographie)
│
├── models/
│   ├── transaction.dart        ← Modèles Transaction + TransactionPreview
│   └── user.dart               ← Modèle AppUser
│
├── services/
│   ├── mock_service.dart       ← Données fictives pour la démo
│   └── api_service.dart        ← Hooks API réels (FastAPI backend)
│
├── screens/
│   ├── login_screen.dart       ← Écran de connexion
│   ├── pin_screen.dart         ← Écran PIN
│   ├── home_screen.dart        ← Écran principal
│   ├── history_screen.dart     ← Historique des transactions
│   └── confirmation_screen.dart← Confirmation de transaction
│
└── widgets/
    └── mic_button.dart         ← Bouton micro animé + bulle de transcription
```

---

## 3. Installation & démarrage

### Prérequis

- Flutter SDK **≥ 3.0.0** ([flutter.dev](https://flutter.dev))
- Dart SDK ≥ 3.0.0
- Android Studio ou VS Code avec extension Flutter
- Appareil Android (API 21+) ou émulateur

### Étapes

```bash
# 1. Cloner le repository
git clone https://github.com/votre-org/mobile-money-voice.git
cd mobile-money-voice/mobile-app

# 2. Installer les dépendances
flutter pub get

# 3. Vérifier la configuration
flutter doctor

# 4. Lancer l'application
flutter run
```

### PIN de démo

Pour tester l'application sans backend :

```
Numéro : n'importe quel numéro
PIN    : 1234
```

---

## 4. Système de design

Tous les tokens de design sont centralisés dans `lib/theme/app_theme.dart`.

### Palette de couleurs

| Nom | Valeur hex | Usage |
|---|---|---|
| `navy` | `#1B3A5C` | Couleur principale, boutons, solde |
| `navyLight` | `#2A5080` | Dégradé carte solde |
| `amber` | `#E07B39` | Accent, bouton confirmer, contacts actifs |
| `amberLight` | `#F4A262` | Hover amber |
| `background` | `#F7F9FC` | Fond général |
| `surface` | `#FFFFFF` | Cartes, boutons clavier |
| `textPrimary` | `#0D1B2A` | Textes principaux |
| `textSecondary` | `#6B7A8D` | Sous-titres, labels |
| `success` | `#16A67D` | Transactions reçues, succès |
| `error` | `#E05252` | Erreurs, transactions échouées |

### Typographie

La police **Sora** (Google Fonts) est utilisée pour toute l'application, déclinée en :

| Style Flutter | Taille | Poids | Usage |
|---|---|---|---|
| `displayMedium` | 32px | 700 | Montant principal, titres majeurs |
| `headlineMedium` | 22px | 600 | Titres d'écran |
| `titleLarge` | 18px | 600 | En-têtes de sections |
| `titleMedium` | 15px | 500 | Labels de transactions |
| `bodyMedium` | 14px | 400 | Texte courant, descriptions |
| `labelLarge` | 13px | 600 | Labels uppercase (filtres, champs) |

### Espacements (`AppSpacing`)

```dart
xs = 4   sm = 8   md = 16   lg = 24   xl = 32   xxl = 48
```

### Rayons (`AppRadius`)

```dart
sm = 8   md = 12   lg = 16   xl = 24   xxl = 32   full = 100
```

---

## 5. Écrans

### 5.1 LoginScreen — `/login`

**Fichier :** `screens/login_screen.dart`

Écran d'entrée de l'application. L'utilisateur saisit son numéro de téléphone.

**Éléments UI :**
- Logo VoiceMoney (icône micro + texte)
- Titre animé avec fade + slide au chargement
- Champ téléphone avec validation
- Bouton "Continuer" (navigue vers `/pin`)
- Lien "Créer un compte" (à implémenter)

**Animations :**
- `FadeTransition` + `SlideTransition` au montage de l'écran (800ms, easeOut)

**Connecter au backend :**
```dart
// Actuellement: navigation directe vers /pin
// À modifier dans _submit() :
final result = await ApiService.login(
  phoneNumber: _phoneCtrl.text,
  pin: pin,  // sera saisi sur l'écran suivant
);
```

---

### 5.2 PinScreen — `/pin`

**Fichier :** `screens/pin_screen.dart`

Saisie du code PIN à 4 chiffres via un clavier personnalisé.

**Paramètre de navigation :**
```dart
Navigator.pushNamed(context, '/pin', arguments: '+229 96 00 00 00');
```

**Éléments UI :**
- 4 indicateurs circulaires (vides → remplis à la saisie)
- Clavier numérique custom (12 touches)
- Touche backspace pour corriger
- Animation "shake" en cas de PIN incorrect

**Logique de validation :**
```dart
// mock_service.dart — PIN démo = '1234'
final ok = await MockService.verifyPin(_pin);

// Remplacer par :
final result = await ApiService.login(
  phoneNumber: phoneNumber,
  pin: _pin,
);
```

**Sécurité :**
- Maximum 3 tentatives à implémenter (voir `MockService`)
- Timeout de session 5 min à gérer au niveau du `NavigatorObserver`

---

### 5.3 HomeScreen — `/home`

**Fichier :** `screens/home_screen.dart`

Écran principal de l'application. Cœur de l'expérience vocale.

**Sections :**

#### A. En-tête
- Salutation personnalisée avec prénom
- Icône notifications (à relier)

#### B. Carte Solde
- Dégradé `navy → navyLight`
- Affichage/masquage du solde (bouton œil)
- 3 actions rapides : Envoyer, Recevoir, Historique

#### C. Section Micro (Centre de l'écran)
- `MicButton` avec 3 états : `idle`, `listening`, `processing`
- `VoiceTranscriptBubble` : affiche le texte reconnu
- Instructions vocales d'exemple

#### D. Contacts rapides
- Liste horizontale scrollable
- Tap → ouverture de l'écran de confirmation

#### E. Transactions récentes
- 3 dernières transactions depuis `MockService`
- Lien "Voir tout" → `/history`

**Parser vocal (à améliorer avec NLP) :**
```dart
// Dans _parseCommand(String text)
// Actuellement : regex simple
// À remplacer par :
final result = await ApiService.processVoiceCommand(text);
```

**Intégration `speech_to_text` :**
```dart
// Remplacer _simulateVoiceCommand() par :
import 'package:speech_to_text/speech_to_text.dart';

final _stt = SpeechToText();

Future<void> _startListening() async {
  final available = await _stt.initialize();
  if (available) {
    _stt.listen(
      onResult: (result) {
        setState(() => _transcript = result.recognizedWords);
        if (result.finalResult) _processCommand(_transcript);
      },
      localeId: 'fr_FR',
    );
  }
}
```

---

### 5.4 HistoryScreen — `/history`

**Fichier :** `screens/history_screen.dart`

Historique complet des transactions avec filtres.

**Filtres disponibles :**

| Index | Label | Type filtré |
|---|---|---|
| 0 | Tout | Toutes |
| 1 | Envois | `TransactionType.send` |
| 2 | Reçus | `TransactionType.receive` |
| 3 | Recharges | `TransactionType.recharge` |
| 4 | Factures | `TransactionType.payment` |

**Regroupement :**
- "Aujourd'hui" / "Hier" / Date formatée (intl)
- Chaque groupe : container card avec séparateurs

**Statuts affichés :**
- `success` → montant normal
- `failed` → badge rouge "Échoué" + montant barré

**Pagination API :**
```dart
// Actuellement : tout en une fois
// À implémenter avec scroll infini :
await ApiService.fetchTransactions(page: _page, limit: 20);
```

---

### 5.5 ConfirmationScreen — `/confirmation`

**Fichier :** `screens/confirmation_screen.dart`

Révision et confirmation d'une transaction avant exécution.

**Paramètre de navigation :**
```dart
Navigator.pushNamed(
  context,
  '/confirmation',
  arguments: TransactionPreview(
    type: TransactionType.send,
    amount: 5000,
    recipientName: 'Maman',
    recipientPhone: '+229 97 00 33 44',
  ),
);
```

**États de l'écran :**

| État | Description |
|---|---|
| `waiting` | Affiche le résumé + boutons Confirmer/Annuler |
| `success` | Animation checkmark vert + message succès |
| `error` | Animation croix rouge + bouton Réessayer |

**Bulle de confirmation vocale :**

L'application affiche (et peut lire via TTS) :
> "Voulez-vous envoyer 5 000 FCFA à Maman ?"

**Intégration TTS :**
```dart
import 'package:flutter_tts/flutter_tts.dart';

final _tts = FlutterTts();

Future<void> _speak(String text) async {
  await _tts.setLanguage('fr-FR');
  await _tts.speak(text);
}

// Appeler dans initState() de ConfirmationScreen :
_speak(_voiceMessage(widget.preview));
```

---

## 6. Widgets réutilisables

### MicButton

**Fichier :** `widgets/mic_button.dart`

```dart
MicButton(
  state: MicState.idle,     // idle | listening | processing | error
  onTap: _onMicTap,
  size: 72,                 // diamètre en px
)
```

**États visuels :**

| State | Couleur | Animation |
|---|---|---|
| `idle` | Navy | Aucune |
| `listening` | Amber | Ripples + pulse |
| `processing` | NavyLight | Spinner rotatif |
| `error` | Red | Aucune |

### VoiceTranscriptBubble

```dart
VoiceTranscriptBubble(
  text: 'Envoie 5000 à Maman',
  isVisible: true,
)
```

Apparaît avec fade + slide. Disparaît quand `text` est vide.

---

## 7. Services : Mock vs API réel

### Basculer du Mock à l'API réelle

Chercher les commentaires `// Remplacer par:` dans chaque écran.

Exemple dans `home_screen.dart` :

```dart
// AVANT (mock)
final user = await MockService.fetchUser();

// APRÈS (API réelle)
final user = await ApiService.fetchCurrentUser();
```

### Configuration de l'URL backend

Dans `api_service.dart` :

```dart
static const String _baseUrl = 'https://votre-backend.com/api/v1';
//                              ↑ Remplacer par l'URL réelle
```

### Gestion du token JWT

```dart
// Après login réussi, le token est stocké dans ApiService._authToken
// Pour la persistance entre sessions, utiliser flutter_secure_storage :

final storage = FlutterSecureStorage();
await storage.write(key: 'jwt_token', value: result.token);
```

---

## 8. Navigation & routes

Toutes les routes sont définies dans `main.dart` via `onGenerateRoute`.

| Route | Écran | Transition | Arguments |
|---|---|---|---|
| `/login` | LoginScreen | Fade | — |
| `/pin` | PinScreen | Slide | `String phoneNumber` |
| `/home` | HomeScreen | Fade | — |
| `/history` | HistoryScreen | Slide | — |
| `/confirmation` | ConfirmationScreen | Slide | `TransactionPreview` |

**Exemple de navigation avec argument :**
```dart
Navigator.pushNamed(
  context,
  '/confirmation',
  arguments: TransactionPreview(...),
);

// Dans ConfirmationScreen, récupérer via :
final preview = ModalRoute.of(context)!.settings.arguments as TransactionPreview;
// OU via le constructeur (approche retenue dans ce projet)
```

---

## 9. Intégration vocale

### Étape 1 — Permissions Android

Dans `android/app/src/main/AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

### Étape 2 — Initialiser `speech_to_text`

```dart
final SpeechToText _stt = SpeechToText();
bool _sttAvailable = false;

@override
void initState() {
  super.initState();
  _stt.initialize().then((v) => setState(() => _sttAvailable = v));
}
```

### Étape 3 — Écoute en français

```dart
await _stt.listen(
  onResult: (result) {
    setState(() => _transcript = result.recognizedWords);
    if (result.finalResult) _processCommand(_transcript);
  },
  localeId: 'fr_FR',
  pauseFor: const Duration(seconds: 3),
  listenMode: ListenMode.confirmation,
);
```

### Étape 4 — Réponse vocale (TTS)

```dart
final FlutterTts _tts = FlutterTts();

Future<void> _respond(String message) async {
  await _tts.setLanguage('fr-FR');
  await _tts.setSpeechRate(0.5);   // Vitesse modérée
  await _tts.setPitch(1.0);
  await _tts.speak(message);
}
```

### Flux complet

```
Utilisateur parle
      ↓
speech_to_text → texte transcrit
      ↓
ApiService.processVoiceCommand(text) [NLP]
      ↓
TransactionPreview retourné
      ↓
Navigation → /confirmation
      ↓
FlutterTts lit la question de confirmation
      ↓
Utilisateur dit "Oui" / tape Confirmer
      ↓
ApiService.sendMoney() / .recharge() / .payBill()
      ↓
FlutterTts lit le résultat
```

---

## 10. Checklist avant production

### Fonctionnel
- [ ] Remplacer tous les `MockService` par `ApiService`
- [ ] Configurer `_baseUrl` dans `api_service.dart`
- [ ] Implémenter la persistance du token JWT (`flutter_secure_storage`)
- [ ] Activer `speech_to_text` (remplacer `_simulateVoiceCommand`)
- [ ] Activer `flutter_tts` sur `ConfirmationScreen`
- [ ] Implémenter la limite de 3 tentatives PIN
- [ ] Implémenter le timeout de session 5 min

### UI/UX
- [ ] Ajouter les polices via `google_fonts` (Sora)
- [ ] Tester sur petits écrans (320px de largeur)
- [ ] Ajouter l'écran d'inscription (`/register`)
- [ ] Ajouter les animations de loading sur `HistoryScreen`

### Sécurité
- [ ] Activer `flutter_secure_storage` pour les tokens
- [ ] Vérifier que le PIN n'est jamais loggué
- [ ] Ajouter `session timeout` (5 min d'inactivité)

### Tests
- [ ] Tests unitaires des parsers (`_parseCommand`, `_extractAmount`)
- [ ] Tests de widget pour `MicButton`
- [ ] Tests d'intégration du flux Login → Home → Confirmation

### Déploiement
- [ ] Ajouter l'icône d'application (`flutter_launcher_icons`)
- [ ] Configurer la signature APK
- [ ] Tester sur Android 6.0+ (API 23)

---

## Crédits

**Équipe Frontend** : Étudiant A + Étudiant B  
**Cahier des charges** : VoiceMoney Project Team  
**Framework** : Flutter (Google)  
**Design** : Moderne & Minimaliste · Palette Navy + Amber

---

*Documentation générée le 16 mars 2026*
