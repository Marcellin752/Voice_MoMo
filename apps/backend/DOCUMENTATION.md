# VoiceMoney — Documentation Backend

> Stack : **Node.js** · **Express.js**
> Base de données : **PostgreSQL** (recommandée) ou MySQL
> Authentification : **JWT** (Bearer token)

---

## Table des matières

1. [Structure du projet](#1-structure-du-projet)
2. [Tables de la base de données](#2-tables-de-la-base-de-données)
3. [Endpoints API](#3-endpoints-api)
4. [Fonctions / Helpers](#4-fonctions--helpers)
5. [Middlewares](#5-middlewares)
6. [Codes d'erreur](#6-codes-derreur)

---

## 1. Structure du projet

```
Backend/
├── src/
│   ├── config/
│   │   └── db.js              # Connexion à la base de données
│   ├── middleware/
│   │   ├── auth.js            # Vérification JWT
│   │   └── validate.js        # Validation des requêtes (Joi / Zod)
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── transactions.routes.js
│   │   └── voice.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── users.controller.js
│   │   ├── transactions.controller.js
│   │   └── voice.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── transaction.service.js
│   │   └── nlp.service.js
│   └── app.js                 # Point d'entrée Express
├── .env
└── package.json
```

---

## 2. Tables de la base de données

### 2.1 `users`

Stocke les informations des utilisateurs inscrits.

| Colonne        | Type           | Contraintes                        | Description                          |
|----------------|----------------|------------------------------------|--------------------------------------|
| `id`           | UUID           | PRIMARY KEY, DEFAULT gen_random_uuid() | Identifiant unique                |
| `full_name`    | VARCHAR(100)   | NOT NULL                           | Nom complet de l'utilisateur         |
| `phone_number` | VARCHAR(20)    | NOT NULL, UNIQUE                   | Numéro de téléphone (format international) |
| `pin_hash`     | VARCHAR(255)   | NOT NULL                           | PIN haché avec bcrypt                |
| `balance`      | DECIMAL(15, 2) | NOT NULL, DEFAULT 0.00             | Solde du compte en FCFA              |
| `currency`     | VARCHAR(10)    | NOT NULL, DEFAULT 'FCFA'           | Devise du compte                     |
| `avatar_url`   | TEXT           | NULLABLE                           | URL de la photo de profil            |
| `is_active`    | BOOLEAN        | NOT NULL, DEFAULT TRUE             | Compte actif ou suspendu             |
| `created_at`   | TIMESTAMP      | NOT NULL, DEFAULT NOW()            | Date de création                     |
| `updated_at`   | TIMESTAMP      | NOT NULL, DEFAULT NOW()            | Dernière modification                |

```sql
CREATE TABLE users (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20)  NOT NULL UNIQUE,
  pin_hash     VARCHAR(255) NOT NULL,
  balance      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency     VARCHAR(10)  NOT NULL DEFAULT 'FCFA',
  avatar_url   TEXT,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

---

### 2.2 `transactions`

Historique de toutes les opérations financières.

| Colonne          | Type           | Contraintes                    | Description                                         |
|------------------|----------------|--------------------------------|-----------------------------------------------------|
| `id`             | UUID           | PRIMARY KEY                    | Identifiant unique de la transaction                |
| `type`           | ENUM           | NOT NULL                       | `send` · `receive` · `recharge` · `payment`         |
| `status`         | ENUM           | NOT NULL, DEFAULT 'pending'    | `pending` · `success` · `failed`                   |
| `amount`         | DECIMAL(15, 2) | NOT NULL                       | Montant en FCFA                                     |
| `sender_id`      | UUID           | FK → users(id), NULLABLE       | Expéditeur (null si dépôt externe)                  |
| `receiver_id`    | UUID           | FK → users(id), NULLABLE       | Destinataire (null si paiement de service)          |
| `label`          | VARCHAR(150)   | NOT NULL                       | Libellé affiché (nom du contact, service, etc.)     |
| `phone_number`   | VARCHAR(20)    | NULLABLE                       | Numéro de téléphone concerné                        |
| `service_code`   | VARCHAR(50)    | NULLABLE                       | Code du service facture (ex: `SBEE`, `SONEB`)       |
| `account_number` | VARCHAR(100)   | NULLABLE                       | Numéro de compte facture                            |
| `note`           | TEXT           | NULLABLE                       | Note optionnelle laissée par l'expéditeur           |
| `fee`            | DECIMAL(10, 2) | NOT NULL, DEFAULT 0.00         | Frais de transaction                                |
| `created_at`     | TIMESTAMP      | NOT NULL, DEFAULT NOW()        | Date d'exécution                                    |

```sql
CREATE TYPE transaction_type   AS ENUM ('send', 'receive', 'recharge', 'payment');
CREATE TYPE transaction_status AS ENUM ('pending', 'success', 'failed');

CREATE TABLE transactions (
  id             UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  type           transaction_type    NOT NULL,
  status         transaction_status  NOT NULL DEFAULT 'pending',
  amount         DECIMAL(15,2)       NOT NULL,
  sender_id      UUID                REFERENCES users(id) ON DELETE SET NULL,
  receiver_id    UUID                REFERENCES users(id) ON DELETE SET NULL,
  label          VARCHAR(150)        NOT NULL,
  phone_number   VARCHAR(20),
  service_code   VARCHAR(50),
  account_number VARCHAR(100),
  note           TEXT,
  fee            DECIMAL(10,2)       NOT NULL DEFAULT 0.00,
  created_at     TIMESTAMP           NOT NULL DEFAULT NOW()
);
```

---

### 2.3 `sessions`

Tokens JWT actifs (pour invalidation à la déconnexion).

| Colonne      | Type      | Contraintes              | Description                          |
|--------------|-----------|--------------------------|--------------------------------------|
| `id`         | UUID      | PRIMARY KEY              | Identifiant du token                 |
| `user_id`    | UUID      | FK → users(id), NOT NULL | Utilisateur associé                  |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE      | Hash du JWT                          |
| `expires_at` | TIMESTAMP | NOT NULL                 | Date d'expiration                    |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW()  | Date de création                     |
| `revoked`    | BOOLEAN   | NOT NULL, DEFAULT FALSE  | Token révoqué (déconnexion)          |

```sql
CREATE TABLE sessions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMP    NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  revoked     BOOLEAN      NOT NULL DEFAULT FALSE
);
```

---

### 2.4 `notifications`

Notifications push envoyées à l'utilisateur.

| Colonne      | Type         | Contraintes             | Description                                         |
|--------------|--------------|-------------------------|-----------------------------------------------------|
| `id`         | UUID         | PRIMARY KEY             | Identifiant unique                                  |
| `user_id`    | UUID         | FK → users(id), NOT NULL | Destinataire                                       |
| `type`       | VARCHAR(50)  | NOT NULL                | `transaction` · `security` · `promo` · `system`    |
| `title`      | VARCHAR(150) | NOT NULL                | Titre de la notification                            |
| `body`       | TEXT         | NOT NULL                | Corps du message                                    |
| `is_read`    | BOOLEAN      | NOT NULL, DEFAULT FALSE | Lu ou non                                           |
| `metadata`   | JSONB        | NULLABLE                | Données supplémentaires (ex: transaction_id)        |
| `created_at` | TIMESTAMP    | NOT NULL, DEFAULT NOW() | Date d'envoi                                        |

```sql
CREATE TABLE notifications (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(150) NOT NULL,
  body       TEXT         NOT NULL,
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  metadata   JSONB,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

---

## 3. Endpoints API

**Base URL :** `https://voicemoney-api.example.com/api/v1`
Les routes protégées nécessitent le header : `Authorization: Bearer <token>`

---

### 3.1 Auth — `/auth`

#### `POST /auth/register`
Crée un nouveau compte utilisateur.

**Body**
```json
{
  "full_name": "Kouassi Adjoua",
  "phone_number": "+22996001122",
  "pin": "1234"
}
```

**Réponse 201**
```json
{
  "access_token": "<jwt>",
  "user": {
    "id": "uuid",
    "full_name": "Kouassi Adjoua",
    "phone_number": "+22996001122",
    "balance": 0,
    "currency": "FCFA"
  }
}
```

**Erreurs**
| Code | Raison |
|------|--------|
| 400  | Champs manquants ou invalides |
| 409  | Numéro de téléphone déjà utilisé |

---

#### `POST /auth/login`
Authentifie un utilisateur et retourne un JWT.

**Body**
```json
{
  "phone_number": "+22996001122",
  "pin": "1234"
}
```

**Réponse 200**
```json
{
  "access_token": "<jwt>",
  "user": { ... }
}
```

**Erreurs**
| Code | Raison |
|------|--------|
| 400  | Champs manquants |
| 401  | PIN incorrect |
| 404  | Compte introuvable |

---

#### `POST /auth/logout` 🔒
Révoque le token courant.

**Réponse 200**
```json
{ "message": "Déconnecté avec succès" }
```

---

### 3.2 Utilisateurs — `/users`

#### `GET /users/me` 🔒
Retourne le profil de l'utilisateur connecté.

**Réponse 200**
```json
{
  "id": "uuid",
  "full_name": "Kouassi Adjoua",
  "phone_number": "+22996001122",
  "balance": 87500.00,
  "currency": "FCFA",
  "avatar_url": null,
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

#### `GET /users/me/balance` 🔒
Retourne uniquement le solde.

**Réponse 200**
```json
{ "balance": 87500.00, "currency": "FCFA" }
```

---

#### `PATCH /users/me` 🔒
Met à jour le profil (nom, avatar).

**Body**
```json
{
  "full_name": "Kouassi A. Adjoua"
}
```

**Réponse 200**
```json
{ "message": "Profil mis à jour", "user": { ... } }
```

---

#### `PATCH /users/me/pin` 🔒
Change le PIN de l'utilisateur.

**Body**
```json
{
  "current_pin": "1234",
  "new_pin": "5678"
}
```

**Réponse 200**
```json
{ "message": "PIN modifié avec succès" }
```

**Erreurs**
| Code | Raison |
|------|--------|
| 401  | PIN actuel incorrect |

---

### 3.3 Transactions — `/transactions`

#### `GET /transactions` 🔒
Liste paginée des transactions de l'utilisateur.

**Query params**
| Paramètre | Type   | Défaut | Description       |
|-----------|--------|--------|-------------------|
| `page`    | number | 1      | Numéro de page    |
| `limit`   | number | 20     | Résultats par page |
| `type`    | string | —      | Filtrer par type  |

**Réponse 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "send",
      "status": "success",
      "amount": 5000.00,
      "label": "Maman",
      "phone_number": "+22997003344",
      "note": null,
      "created_at": "2025-03-15T14:22:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

---

#### `POST /transactions/send` 🔒
Transfère de l'argent vers un autre numéro.

**Body**
```json
{
  "recipient_phone": "+22997003344",
  "amount": 5000,
  "note": "Remboursement"
}
```

**Réponse 201**
```json
{
  "transaction_id": "uuid",
  "status": "success",
  "new_balance": 82500.00
}
```

**Erreurs**
| Code | Raison |
|------|--------|
| 400  | Montant invalide ou solde insuffisant |
| 404  | Destinataire introuvable |

---

#### `POST /transactions/recharge` 🔒
Recharge crédit téléphonique.

**Body**
```json
{
  "phone_number": "+22996001122",
  "amount": 2000
}
```

**Réponse 201**
```json
{
  "transaction_id": "uuid",
  "status": "success",
  "new_balance": 85500.00
}
```

---

#### `POST /transactions/pay-bill` 🔒
Paiement de facture (SBEE, SONEB, etc.).

**Body**
```json
{
  "service_code": "SBEE",
  "amount": 12500,
  "account_number": "0123456789"
}
```

**Réponse 201**
```json
{
  "transaction_id": "uuid",
  "status": "success",
  "new_balance": 75000.00
}
```

---

### 3.4 Commandes vocales — `/voice`

#### `POST /voice/parse` 🔒
Analyse un texte transcrit et retourne l'intention détectée.

**Body**
```json
{ "text": "Envoie 5000 francs à Maman" }
```

**Réponse 200**
```json
{
  "action": "send",
  "amount": 5000,
  "recipient": "Maman",
  "phone_number": null,
  "confidence": 0.97,
  "raw_text": "Envoie 5000 francs à Maman"
}
```

**Valeurs de `action`**
| Valeur    | Description               |
|-----------|---------------------------|
| `send`    | Transfert d'argent        |
| `balance` | Consultation du solde     |
| `recharge`| Recharge téléphonique     |
| `pay`     | Paiement de facture       |
| `unknown` | Commande non reconnue     |

---

## 4. Fonctions / Helpers

### `generateToken(userId)` — `src/services/auth.service.js`
Génère un JWT signé avec l'ID utilisateur.

```js
/**
 * @param {string} userId - UUID de l'utilisateur
 * @returns {string} JWT signé (expire dans 7 jours)
 */
function generateToken(userId) { ... }
```

---

### `hashPin(pin)` — `src/services/auth.service.js`
Hache un PIN à 4 chiffres avec bcrypt.

```js
/**
 * @param {string} pin - PIN en clair (4 chiffres)
 * @returns {Promise<string>} Hash bcrypt
 */
async function hashPin(pin) { ... }
```

---

### `verifyPin(pin, hash)` — `src/services/auth.service.js`
Compare un PIN en clair avec son hash.

```js
/**
 * @param {string} pin  - PIN saisi par l'utilisateur
 * @param {string} hash - Hash stocké en base
 * @returns {Promise<boolean>}
 */
async function verifyPin(pin, hash) { ... }
```

---

### `debitUser(userId, amount, client)` — `src/services/transaction.service.js`
Débite le solde d'un utilisateur dans une transaction SQL.

```js
/**
 * @param {string} userId  - UUID de l'utilisateur
 * @param {number} amount  - Montant à débiter
 * @param {object} client  - Client PostgreSQL (pour transaction atomique)
 * @throws {Error} Si le solde est insuffisant
 */
async function debitUser(userId, amount, client) { ... }
```

---

### `creditUser(userId, amount, client)` — `src/services/transaction.service.js`
Crédite le solde d'un utilisateur dans une transaction SQL.

```js
/**
 * @param {string} userId  - UUID de l'utilisateur
 * @param {number} amount  - Montant à créditer
 * @param {object} client  - Client PostgreSQL (pour transaction atomique)
 */
async function creditUser(userId, amount, client) { ... }
```

---

### `parseVoiceCommand(text)` — `src/services/nlp.service.js`
Analyse un texte en langage naturel et retourne l'intention détectée.

```js
/**
 * @param {string} text - Texte transcrit de la commande vocale
 * @returns {{ action: string, amount: number|null, recipient: string|null,
 *             phone_number: string|null, confidence: number }}
 */
function parseVoiceCommand(text) { ... }
```

---

### `createNotification(userId, type, title, body, metadata?)` — `src/services/notification.service.js`
Insère une notification en base pour un utilisateur.

```js
/**
 * @param {string} userId
 * @param {string} type     - 'transaction' | 'security' | 'promo' | 'system'
 * @param {string} title
 * @param {string} body
 * @param {object} [metadata] - Données supplémentaires (ex: { transaction_id })
 */
async function createNotification(userId, type, title, body, metadata) { ... }
```

---

## 5. Middlewares

### `authenticate` — `src/middleware/auth.js`
Vérifie la validité du JWT et attache `req.user` à la requête.

```js
// Usage
router.get('/users/me', authenticate, usersController.getMe);
```

Comportement :
- Extrait le token du header `Authorization: Bearer <token>`
- Vérifie la signature et l'expiration
- Vérifie que la session n'est pas révoquée en base
- Retourne **401** si le token est absent, invalide ou révoqué

---

### `validate(schema)` — `src/middleware/validate.js`
Valide le body de la requête contre un schéma Joi/Zod.

```js
// Usage
router.post('/auth/register', validate(registerSchema), authController.register);
```

- Retourne **400** avec les détails de validation si le body est invalide

---

## 6. Codes d'erreur

Toutes les erreurs retournent un objet JSON avec un champ `detail` :

```json
{ "detail": "Message d'erreur explicite" }
```

| Code HTTP | Signification                                  |
|-----------|------------------------------------------------|
| 400       | Requête invalide (champs manquants/incorrects) |
| 401       | Non authentifié ou PIN incorrect               |
| 403       | Accès refusé                                   |
| 404       | Ressource introuvable                          |
| 409       | Conflit (ex: numéro déjà utilisé)              |
| 422       | Erreur métier (ex: solde insuffisant)          |
| 500       | Erreur serveur interne                         |
