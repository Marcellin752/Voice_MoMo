# 🎙️ Voice MoMo

**Voice MoMo** est une solution innovante de paiement mobile assistée par intelligence artificielle. Elle permet aux utilisateurs d'effectuer des transactions Mobile Money (MTN Bénin) simplement en utilisant leur voix.

---

## 🚀 État du Projet
> [!IMPORTANT]
> Ceci est la **première version fonctionnelle** du projet.

Toutes les briques technologiques (Mobile, Backend, NLP) sont désormais intégrées et opérationnelles pour un cycle complet de transaction vocale.

---

## 🏗️ Architecture du Système

Le projet repose sur une architecture modulaire composée de trois piliers principaux :

1.  **📱 Mobile (React / Capacitor)** : Une application Android native qui gère l'interface utilisateur, la capture audio, l'accès aux contacts et l'exécution des codes USSD.
2.  **⚙️ Backend (Node.js / Prisma)** : L'orchestrateur central gérant la logique métier, la persistance des données et les interactions MMI.
3.  **🧠 NLP Module (Python / FastAPI)** : Le cerveau du projet, utilisant **Gemini 2.0 Flash** pour la transcription (STT), l'analyse d'intention (NLU) et la synthèse vocale (TTS).

---

## ✨ Fonctionnalités Clés

-   **🗣️ Commandes Vocales** : "Envoie 5000 FCFA à Jean"
-   **👤 Intégration Contacts** : Résolution automatique des numéros depuis le répertoire Android.
-   **⚡ USSD Background** : Exécution intelligente des codes USSD (`*880#`, `*123#`).
-   **🤖 IA Conversationnelle** : Retours vocaux naturels pour confirmer les actions.

---

## 🛠️ Installation et Déploiement

Pour configurer l'environnement de développement et lancer le projet, consultez notre guide détaillé :

👉 **[Guide de Lancement (LAUNCH_GUIDE.md)](file:///home/rayann-bch/HUB_PROJECTS/Voice_MoMo/LAUNCH_GUIDE.md)**

---

## 📦 Releases (APK)

Les dernières versions compilées pour Android sont disponibles à la racine du dépôt pour faciliter les tests :
-   [Dernier Build Stable (v11)](file:///home/rayann-bch/HUB_PROJECTS/Voice_MoMo/voicemomo_v11.apk)
-   [Debug Build](file:///home/rayann-bch/HUB_PROJECTS/Voice_MoMo/app-debug.apk)

---

*Développé avec ❤️ pour simplifier l'inclusion financière.*
