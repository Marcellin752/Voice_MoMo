# Build APK Android — Voice MoMo

## Structure du dépôt (monorepo)

Tout est sous **`apps/`**. Il n’y a **plus** de dossiers `Mobile/`, `Backend/` ou `NLP/` à la racine.

```
Voice_MoMo/
├── apps/mobile/      ← app React + Capacitor + android/
├── apps/backend/
├── apps/nlp/
├── docs/
└── scripts/build-apk.sh
```

Si tu as encore d’anciens dossiers à la racine en local : supprime-les après un `git pull`, ils ne font plus partie du projet.

---

## Option A — APK via GitHub (recommandé si pas d’Android Studio)

Chaque push sur `main` lance le workflow **Build Android APK**. L’APK est publié en **Release** (prerelease) sur le dépôt GitHub.

1. Onglet **Actions** → workflow réussi
2. Ou **Releases** → télécharger `app-debug.apk`

Aucun SDK Android requis sur ton PC.

---

## Option B — Build local

### Prérequis

1. **Node.js 22+** et **Java 21** (JDK Temurin recommandé)
2. **Android SDK** :
   - Installer [Android Studio](https://developer.android.com/studio), ou
   - SDK command-line uniquement
3. Variables d’environnement (à mettre dans `~/.bashrc` ou `~/.zshrc`) :

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Vérifier :

```bash
echo $ANDROID_HOME
ls "$ANDROID_HOME/platforms"
```

### Build en une commande (depuis la racine du repo)

```bash
chmod +x scripts/build-apk.sh
./scripts/build-apk.sh
```

Le script crée `apps/mobile/android/local.properties` (fichier **local**, non versionné).

### Build manuel

```bash
cd apps/mobile
npm ci
cp .env.example .env   # optionnel — URLs API/NLP pour tests LAN
npm run build
npx cap sync android
cd android
# si besoin : echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleDebug
```

APK : `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

---

## Erreur fréquente : `SDK location not found`

```
SDK location not found. Define ANDROID_HOME or sdk.dir in local.properties
```

**Ce n’est pas un bug du code** — le SDK Android n’est pas installé ou pas configuré sur cette machine.

**Correctif :**

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
echo "sdk.dir=$ANDROID_HOME" > apps/mobile/android/local.properties
```

Puis relancer le build.

---

## Chemins à ne pas utiliser

| ❌ Ancien / incorrect | ✅ Correct |
|----------------------|------------|
| `Mobile/android/` | `apps/mobile/android/` |
| `cd android` depuis la racine | `cd apps/mobile/android` |
| `Backend/` | `apps/backend/` |

---

## URLs dans l’APK

- **CI / Release** : URLs Render (définies dans `.github/workflows/build-apk.yml`)
- **Dev local** : `apps/mobile/.env` avec ton IP LAN avant `npm run build`
- **Build local d'un APK autonome** (à installer sur un téléphone hors de ton Wi-Fi) : les variables
  d'environnement du shell priment sur `.env` pour Vite — exporte les URLs Render avant le build,
  sinon l'APK embarque l'IP LAN de `.env` et l'OTP ne part jamais (45 s d'attente puis erreur réseau) :

  ```bash
  export VITE_API_BASE_URL=https://voice-momo-backend-2qy2.onrender.com
  export VITE_VOICE_AI_URL=https://voice-momo.onrender.com
  ./scripts/build-apk.sh
  ```

  Le script affiche l'URL backend qui sera figée dans l'APK et prévient si elle est locale.

---

## Village de l’Innovation (distribution QR)

Parcours visiteurs : **QR → page d’install → APK**.

| Élément | URL / chemin |
|---------|----------------|
| Page d’install (QR) | https://marcellin752.github.io/Voice_MoMo/installer/ |
| Release stable APK | https://github.com/Marcellin752/Voice_MoMo/releases/tag/village-2026 |
| Téléchargement direct | https://github.com/Marcellin752/Voice_MoMo/releases/download/village-2026/app-debug.apk |
| Fichiers page / QR imprimable | `docs/installer/` (`index.html`, `qr.png`, `qr-print.png`, `print-qr.html`) |

Republier l’APK figé : Actions → **Release village APK** → Run workflow (ou `git tag village-2026 && git push origin village-2026` sur le commit validé).

### Checklist stand (matin, avant ouverture)

1. **Render** : `SHOW_OTP_WHEN_SMS_FAILS=true` encore actif sur `voice-momo-backend` (code à l’écran ; SMS Twilio ne part pas vers le Bénin).
2. **Warm-up** : `GET` `/health` sur le backend et le NLP (Render gratuit) ; re-ping toutes les ~10 min.
3. **Téléphones du stand** (2–3, SIM MTN) : APK `village-2026` installé ; permissions micro, téléphone, SMS, **Accessibilité Voice MoMo** déjà accordées ; contact de démo prêt ; petit montant.
4. **QR** : imprimer `docs/installer/print-qr.html` (A4 + petit format table) ; une personne « install » pour aider aux sources inconnues.
5. **Filet hors-ligne** : copie de `app-debug.apk` sur une clé USB / partage Nearby si GitHub est lent sur le site.
6. **Script démo ~60 s** : « Quel est mon solde » ou « Envoie 200 francs à … » → confirmation orale → USSD.
7. **Ne pas promettre** : iPhone, OTP par SMS réel, recharge/retrait/facture 100 % vocaux, Play Store.
