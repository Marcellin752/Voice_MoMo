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

# URL backend qui sera figée dans l'APK : variable d'environnement (prioritaire pour Vite),
# sinon apps/mobile/.env, sinon le défaut de api.ts (localhost).
effective_api_url="${VITE_API_BASE_URL:-}"
if [[ -z "$effective_api_url" && -f .env ]]; then
  effective_api_url="$(grep -E '^VITE_API_BASE_URL=' .env | tail -n1 | cut -d= -f2- || true)"
fi
effective_api_url="${effective_api_url:-http://localhost:3001 (défaut)}"
echo "→ Backend figé dans l'APK : $effective_api_url"
if [[ "$effective_api_url" == http://* ]]; then
  echo "⚠ URL locale/LAN : cet APK ne fonctionnera que sur le même Wi-Fi, avec le backend lancé."
  echo "  Pour un APK autonome (serveurs Render), exporte avant de lancer ce script :"
  echo "    export VITE_API_BASE_URL=https://voice-momo-backend-2qy2.onrender.com"
  echo "    export VITE_VOICE_AI_URL=https://voice-momo.onrender.com"
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
