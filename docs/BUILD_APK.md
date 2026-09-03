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
