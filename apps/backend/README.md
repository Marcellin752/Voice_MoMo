# Voice MoMo — Backend (API + MTN USSD)

Backend Node.js **TypeScript** : API historique (auth, users, transactions, voice) + système **MTN MoMo USSD** (file BullMQ, worker, modem mock/réel, WebSocket, Prisma).

## Prérequis

- Node.js 20+
- PostgreSQL 15+
- Redis 7+ (BullMQ)

## Installation locale

```bash
cd apps/backend
cp .env.example .env
# Éditer .env : DATABASE_URL, JWT_SECRET, PIN_ENCRYPTION_KEY (64 hex), REDIS_*
npm ci
npx prisma migrate deploy
npm run dev
```

Dans un second terminal :

```bash
cd apps/backend
npm run dev:worker
```

- API : `http://localhost:3001`
- Santé : `GET /health`
- API USSD (IA vocale) : `POST /api/v1/transaction`, `GET /api/v1/transaction/:jobId/status`
- WebSocket Socket.IO : chemin `/events` (ex. `ws://localhost:3001/events?userId=<uuid>`)
- Bull Board (si `BULL_BOARD_ENABLED=true`) : `http://localhost:3001/admin/queues`

## Docker (mode mock modem)

```bash
cd apps/backend
docker compose up --build
```

Les services `api` et `worker` utilisent `USE_MOCK_MODEM=true` par défaut (pas de matériel GSM).

## Modems GSM (production)

1. Définir `USE_MOCK_MODEM=false`.
2. Renseigner `MODEM_0`, `MODEM_1`, … (JSON : `portPath`, `country`, `simNumber`), cf. `.env.example`.
3. Brancher les équipements et vérifier les ports série (`/dev/ttyUSB*` sous Linux).

Le client série (`modem-client.ts`) est fourni pour un usage avancé ; en environnement réel, valider les délais AT et les flux USSD avec votre matériel.

## Tests

```bash
npm test
npm run build
```

## Ancienne entrée `node src/app.js`

L’entrée unique est désormais **`dist/index.js`** (build TypeScript). Les routes Express historiques sont chargées depuis `legacy/registerRoutes.js`.

## Sécurité PIN

- Chiffrement : `aes256:<iv_hex>:<cipher_hex>` (clé `PIN_ENCRYPTION_KEY`, 32 octets en hex).
- Ne jamais journaliser le PIN en clair.

## Contrat IA vocale

Voir le fichier de spécification `cursor_prompt_mtn_ussd.md` : corps JSON pour `POST /api/v1/transaction`, polling du statut, événements WebSocket.
