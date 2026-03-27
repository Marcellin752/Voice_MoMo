CREATE TABLE networks (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(20)  UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  country      VARCHAR(50),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(100) NOT NULL,
  phone_number     VARCHAR(20)  NOT NULL UNIQUE,
  pin_hash         VARCHAR(255) NOT NULL,
  balance          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency         VARCHAR(10)  NOT NULL DEFAULT 'XOF',
  avatar_url       TEXT,
  preferred_network_id UUID REFERENCES networks(id) ON DELETE SET NULL,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
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
  network_id     UUID                REFERENCES networks(id) ON DELETE SET NULL,
  label          VARCHAR(150)        NOT NULL,
  phone_number   VARCHAR(20),
  service_code   VARCHAR(50),
  account_number VARCHAR(100),
  note           TEXT,
  fee            DECIMAL(10,2)       NOT NULL DEFAULT 0.00,
  created_at     TIMESTAMP           NOT NULL DEFAULT NOW()
);

CREATE TABLE mmi_codes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id    UUID         NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  code_type     VARCHAR(50)  NOT NULL,
  description   VARCHAR(255),
  mmi_code      VARCHAR(100) NOT NULL,
  parameters    JSONB,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE(network_id, code_type)
);

CREATE TABLE mmi_executions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mmi_code_id      UUID         REFERENCES mmi_codes(id) ON DELETE SET NULL,
  network_id       UUID         NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  code_type        VARCHAR(50)  NOT NULL,
  mmi_code         VARCHAR(100) NOT NULL,
  status           VARCHAR(50)  NOT NULL DEFAULT 'pending',
  response         TEXT,
  error_message    TEXT,
  executed_at      TIMESTAMP    NOT NULL DEFAULT NOW()
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

-- Insérer les réseaux mobiles du Bénin
INSERT INTO networks (code, name, country) VALUES
('MTN', 'MTN Benin', 'Benin'),
('MOOV', 'Moov Benin', 'Benin'),
('CELTIIS', 'Celtiis Benin', 'Benin');

-- Insérer les codes MMI pour MTN Bénin
INSERT INTO mmi_codes (network_id, code_type, description, mmi_code) VALUES
((SELECT id FROM networks WHERE code = 'MTN'), 'balance', 'Consulter solde MTN', '*123#'),
((SELECT id FROM networks WHERE code = 'MTN'), 'data_balance', 'Consulter solde données MTN', '*144#'),
((SELECT id FROM networks WHERE code = 'MTN'), 'credit_recharge', 'Recharger crédit MTN', '*507#'),
((SELECT id FROM networks WHERE code = 'MTN'), 'ussd_menu', 'Menu USSD MTN', '*156#'),
((SELECT id FROM networks WHERE code = 'MTN'), 'transfer', 'Transfert d''argent MTN Money', '*123*1*'),
((SELECT id FROM networks WHERE code = 'MTN'), 'momo_balance', 'Solde MTN Money', '*105#'),
((SELECT id FROM networks WHERE code = 'MTN'), 'momo_send', 'Envoyer argent MTN Money', '*105*1*');

-- Insérer les codes MMI pour MOOV Bénin
INSERT INTO mmi_codes (network_id, code_type, description, mmi_code) VALUES
((SELECT id FROM networks WHERE code = 'MOOV'), 'balance', 'Consulter solde MOOV', '*124#'),
((SELECT id FROM networks WHERE code = 'MOOV'), 'data_balance', 'Consulter solde données MOOV', '*145#'),
((SELECT id FROM networks WHERE code = 'MOOV'), 'credit_recharge', 'Recharger crédit MOOV', '*508#'),
((SELECT id FROM networks WHERE code = 'MOOV'), 'ussd_menu', 'Menu USSD MOOV', '*100#'),
((SELECT id FROM networks WHERE code = 'MOOV'), 'transfer', 'Transfert d''argent MOOV Money', '*124*1*'),
((SELECT id FROM networks WHERE code = 'MOOV'), 'momo_balance', 'Solde MOOV Money', '*106#'),
((SELECT id FROM networks WHERE code = 'MOOV'), 'momo_send', 'Envoyer argent MOOV Money', '*106*1*');

-- Insérer les codes MMI pour CELTIIS Bénin
INSERT INTO mmi_codes (network_id, code_type, description, mmi_code) VALUES
((SELECT id FROM networks WHERE code = 'CELTIIS'), 'balance', 'Consulter solde CELTIIS', '*125#'),
((SELECT id FROM networks WHERE code = 'CELTIIS'), 'data_balance', 'Consulter solde données CELTIIS', '*146#'),
((SELECT id FROM networks WHERE code = 'CELTIIS'), 'credit_recharge', 'Recharger crédit CELTIIS', '*509#'),
((SELECT id FROM networks WHERE code = 'CELTIIS'), 'ussd_menu', 'Menu USSD CELTIIS', '*101#'),
((SELECT id FROM networks WHERE code = 'CELTIIS'), 'transfer', 'Transfert d''argent CELTIIS', '*125*1*'),
((SELECT id FROM networks WHERE code = 'CELTIIS'), 'momo_balance', 'Solde CELTIIS Money', '*107#'),
((SELECT id FROM networks WHERE code = 'CELTIIS'), 'momo_send', 'Envoyer argent CELTIIS Money', '*107*1*');
