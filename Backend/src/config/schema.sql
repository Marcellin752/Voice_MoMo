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
