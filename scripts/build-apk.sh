#!/usr/bin/env bash
# Build debug APK depuis la racine du monorepo (apps/mobile).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
ANDROID="$MOBILE/android"
LOCAL_PROPS="$ANDROID/local.properties"

resolve_sdk_dir() {
  if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
    echo "$ANDROID_HOME"
    return 0
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT" ]]; then
    echo "$ANDROID_SDK_ROOT"
    return 0
  fi
  if [[ -d "$HOME/Android/Sdk" ]]; then
    echo "$HOME/Android/Sdk"
    return 0
  fi
  return 1
}

if ! SDK_DIR="$(resolve_sdk_dir)"; then
  echo "❌ Android SDK introuvable."
  echo ""
  echo "Installe Android Studio (ou command-line tools), puis définis :"
  echo "  export ANDROID_HOME=\"\$HOME/Android/Sdk\""
  echo "  export PATH=\"\$PATH:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/cmdline-tools/latest/bin\""
  echo ""
  echo "Voir docs/BUILD_APK.md pour le guide complet."
  echo "Alternative : récupérer l'APK depuis GitHub Actions → Releases (workflow Build Android APK)."
  exit 1
fi

mkdir -p "$ANDROID"
echo "sdk.dir=$SDK_DIR" > "$LOCAL_PROPS"
echo "✓ SDK Android : $SDK_DIR"
echo "✓ local.properties écrit : $LOCAL_PROPS"

cd "$MOBILE"
if [[ ! -d node_modules ]]; then
  echo "→ npm ci…"
  npm ci
fi

if [[ ! -f .env ]]; then
  echo "⚠ Pas de apps/mobile/.env — build avec les URLs par défaut Vite."
  echo "  Copie apps/mobile/.env.example si tu testes sur téléphone en local."
fi

echo "→ npm run build…"
npm run build

echo "→ npx cap sync android…"
npx cap sync android

cd "$ANDROID"
chmod +x gradlew
echo "→ ./gradlew assembleDebug…"
./gradlew assembleDebug --no-daemon

APK="$ANDROID/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "✅ APK prêt : $APK"
