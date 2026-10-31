# HANDOFF_TESTS — vérifications restant à faire (reprise du travail)

**Pour qui :** la personne (et son agent) qui reprend le projet après la session du 2026-10-31.
**Pourquoi :** les correctifs ci-dessous sont dans `origin/main`, mais **rien n'a été vérifié sur un téléphone ni sur les services déployés** : la session n'avait ni appareil, ni accès aux hôtes Render, ni à la base. Chaque test ci-dessous dit ce qui est attendu ; le résultat réel doit être consigné (section 6).
**État de départ :** `origin/main` = merge `7020529a` (série de correctifs + upstream `3696121`) + `daaa2cb5` (CI) + les commits de docs. APK de test : release `build-111` (prerelease GitHub, debug, non signé pour la prod).

Règle d'or du dépôt : **UNDERSTAND FIRST. CHANGE ONLY WHEN JUSTIFIED.** Lire `CLAUDE.md` en premier, puis `PROJECT_STATUS.md`, la dernière entrée de `SESSION_LOG.md` et les items Critical/High de `TODO.md`.

## 0. Mise en route
1. `git pull` (branche `main`, pas de branche de travail). Ne jamais `git add -A`, ne jamais force-push, jamais d'auteur/co-auteur IA dans les commits (voir `CLAUDE.md` §4).
2. Créer les `.env` à partir des `.env.example` (`apps/backend`, `apps/nlp`, `apps/mobile`). Les `.env` sont ignorés par git : **ne jamais les committer**, ne jamais coller un PIN, un OTP, un token ou une clé dans un commit, un log ou un message.
3. Environnement : Node ≥ 22.18 (le test runner mobile est celui de Node), Python 3.12 pour le NLP, `adb` pour le téléphone.

## 1. Tests automatiques (poste de dev) — attendus déjà constatés le 2026-10-31
| # | Commande (depuis le dossier) | Attendu |
|---|---|---|
| A1 | `apps/backend` : `npm ci && npx tsc --noEmit && npm test` | `tsc` muet ; Jest **6 suites / 26 tests** passent |
| A2 | `apps/nlp` : `python -m venv venv && venv/bin/pip install -r requirements.txt && venv/bin/python -m pytest -q -p no:cacheprovider tests/` | **54 passed** (~2,5 min ; aucune variable d'environnement requise, `tests/conftest.py` pose un `JWT_SECRET` de test et une fausse clé Gemini) |
| A3 | `apps/mobile` : `npm ci && npm test` puis `npx vite build --outDir "$(mktemp -d)"` | **7 tests** passent ; le build réussit (≈2060 modules) sans écraser `dist/` |
| A4 | GitHub → Actions → « Build Android APK » | dernier run **vert** (run 41189963418 rouge = ancien bug `tools` corrigé par `daaa2cb5` ; run 41191299972 vert → release `build-111`) |

Si un nombre diffère : c'est une dérive à expliquer avant tout nouveau travail (A2 : vérifier que `apps/nlp/.env` n'impose pas une vraie clé ; A1 : le test SQL de `verifyOtp` n'existe pas, la couche base n'est pas testée).

## 2. Services déployés (Render) — à faire par quelqu'un qui a accès au dashboard
Ne rien exécuter contre la base Render (`CLAUDE.md` : jamais de migration ni de script sur les bases Render ; ne jamais charger `legacy/config/db.js` avec une `DATABASE_URL` non locale). Pour les requêtes, utiliser **son propre numéro de test**.

| # | Vérification | Attendu |
|---|---|---|
| B1 | Dashboard Render : le dernier déploiement de `voice-momo-backend` et de `voice-momo-nlp` correspond au commit `7020529a` ou plus récent (sinon lancer un déploiement manuel : l'auto-deploy n'a pas été vérifié) | nouveau code en ligne |
| B2 | Variables d'environnement — backend : fournisseur SMS configuré (Twilio **ou** Termii) ; `ALLOW_DEV_OTP` **absente ou `false`**. NLP : `JWT_SECRET` présent et **identique** à celui du backend ; `ENABLE_TEST_ENDPOINTS` **absente**. | conforme (le propriétaire a affirmé que SMS + `JWT_SECRET` sont configurés — **[Claimed]**, non vérifié) |
| B3 | NLP : `GET /health` | 200 (le service démarre ; sans `JWT_SECRET` il refuse de démarrer → échec de déploiement visible dans les logs) |
| B4 | NLP : `POST /api/auth/token` (sans identifiants) et `GET /api/pending-transactions` (sans en-tête `Authorization`) | **404** pour le premier ; **401** pour le second (avant correctif : un token était délivré à n'importe qui) |
| B5 | Backend : `POST /api/auth/send-otp` avec **son** numéro | le SMS arrive ; la réponse **ne contient pas** de `devCode` ; puis `POST /api/auth/verify-otp` avec le code `000000` → **refusé** |
| B6 | Backend : un compte créé par OTP puis `POST /api/auth/login` avec `pin: "0000"` | **401** « PIN incorrect. » |
| B7 | Logs Render (backend + NLP) après ces essais | aucun code OTP, aucun PIN, aucune URL contenant `key=` |
| B8 | **Faire pivoter la clé Gemini** (Google AI Studio) et la mettre à jour sur Render ; relire les anciens logs NLP | avant le correctif T-004, une erreur de connexion écrivait l'URL **avec la clé** au niveau WARNING |

## 3. Téléphone Android — APK `build-111` (GitHub → Releases → `app-debug.apk`)
Utiliser **ses propres numéros**, des **montants minimes** et un destinataire que l'on contrôle : les transferts bougent de l'argent réel via USSD MTN. Ne rien tester avec le compte d'un tiers.

| # | Scénario | Attendu / à noter |
|---|---|---|
| C1 | Connexion par OTP réel (SMS) | le code arrive par SMS ; connexion réussie ; **aucun code affiché à l'écran** |
| C2 | Mauvais code OTP, puis `000000` | message **réel du serveur** affiché (et lu à voix haute ?), plus le générique « Erreur réseau » (T-019) ; `000000` refusé |
| C3 | Réglages → changer le PIN (ancien PIN `0000` sur un compte neuf) | accepté ; un mauvais ancien PIN affiche le vrai message (T-068/T-019) |
| C4 | Parcours vocal complet : « envoie 100 francs à <contact> » → lecture à voix haute → confirmation | l'USSD MTN s'ouvre avec le bon montant/destinataire ; **noter ce que l'app dit à chaque étape** |
| C5 | Échecs (T-007, preuve manquante) : solde insuffisant, numéro inconnu, annulation, délai de 45 s dépassé | **noter le texte USSD exact reçu et ce que l'app annonce** ; l'app ne doit jamais dire « réussi » sur un échec (le risque connu : analyse par sous-chaînes, « effectué » dans « non effectué ») |
| C6 | Solde par SMS, puis solde par USSD (clavier PIN sécurisé) | solde annoncé ; le PIN n'est ni prononcé ni envoyé au NLP |
| C7 | Fuite de PIN dans logcat (T-003, finding encore ouvert côté natif) : `adb logcat \| grep -i "880\*"` pendant un solde USSD | **constater** si `*880*4*<PIN>#` apparaît (le code natif logue les chaînes USSD) ; consigner oui/non **sans écrire le PIN** |
| C8 | Code *upstream* jamais testé sur appareil (T-011) : clavier PIN sécurisé, biométrie vocale (enrôlement + vérification), choix dual-SIM, codes USSD avec montant, transfert inter-réseaux (Linka : frais + SMS) | fonctionne ou non, avec captures/logs ; relire l'ADR-0012 (proposé) avant de juger le clavier : le cahier des charges demande « zéro saisie tactile » |
| C9 | Recharge / retrait / facture / forfait | l'app **ouvre seulement le menu USSD** (conception volontaire, ADR-0010) : vérifier qu'elle ne promet pas plus |
| C10 | Hors ligne ou serveur NLP froid (démarrage à froid Render) | l'écran ne reste pas bloqué indéfiniment sur « traitement » (T-061 : pas de timeout aujourd'hui — **le constater**) |

## 4. À ne pas faire
- Pas de refactor large, pas de suppression de code « apparemment inutile » (voir T-058, seulement par étapes approuvées).
- Pas de correctif sans test d'abord (cas qui échoue, puis qui passe) et sans accord sur l'item (`TODO.md`).
- Ne pas « corriger » T-069 en définissant `VITE_NLP_API_URL` : ce serait activer un envoi de contacts que l'ADR-0005 interdit.
- Ne pas rouvrir la base ou les hôtes déployés avec des requêtes d'écriture.

## 5. Ensuite (ordre proposé, chaque item se valide avec le propriétaire)
1. **T-004 partie 2** : `gemini_client.py` met encore la clé dans l'URL ; ajouter l'en-tête `x-goog-api-key` par-dessus la boucle de retry d'upstream.
2. **T-061** : client NLP avec timeout (le hook vocal a été réécrit en amont).
3. **T-011** : revalider T-003 / T-007 / T-017 contre l'arbre fusionné (les résultats de C5, C7, C8 y servent).
4. **T-005** : limites de tentatives (décision de politique de verrouillage requise). **T-010** : porte de tests en CI (la CI ne fait que construire l'APK).
5. Décisions ouvertes : ADR-0012 à 0014 (proposés), T-069, T-012 (documents investisseurs hors git qui annoncent « PRODUCTION READY »).

## 6. Comment consigner les résultats
- Ajouter **une entrée** à la fin de `SESSION_LOG.md` (jamais réécrire l'historique) : ce qui a été exécuté, le résultat réel, ce qui reste.
- Mettre à jour **en place** `TODO.md` (statut de l'item) et `PROJECT_STATUS.md` (section « Verified functional ») avec la preuve. Étiquettes : **[Ran]** exécuté, **[Read]** lu dans le code, **[Claimed]** affirmé sans preuve, **[Unknown]**.
- Un test raté ou un comportement inattendu = nouvel item `T-nnn` dans `TODO.md` avec un critère « Done when », pas une correction silencieuse.
- Ne jamais noter une fonctionnalité comme « fonctionnelle » sans preuve ; ne pas inventer d'historique.
