-- Deduplicate any existing duplicate non-null push tokens before creating partial unique indexes.
-- Preserves the token on the most recently updated user row and clears older duplicates to NULL.
WITH ranked_expo AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY expo_push_token ORDER BY "updatedAt" DESC, id DESC) as rk
  FROM users
  WHERE expo_push_token IS NOT NULL
)
UPDATE users
SET expo_push_token = NULL
WHERE id IN (SELECT id FROM ranked_expo WHERE rk > 1);

WITH ranked_fcm AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY fcm_token ORDER BY "updatedAt" DESC, id DESC) as rk
  FROM users
  WHERE fcm_token IS NOT NULL
)
UPDATE users
SET fcm_token = NULL
WHERE id IN (SELECT id FROM ranked_fcm WHERE rk > 1);

WITH ranked_apns AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY apns_token ORDER BY "updatedAt" DESC, id DESC) as rk
  FROM users
  WHERE apns_token IS NOT NULL
)
UPDATE users
SET apns_token = NULL
WHERE id IN (SELECT id FROM ranked_apns WHERE rk > 1);

-- Create partial unique indexes on non-null tokens.
-- Multiple users may have NULL tokens without violation, but non-null device tokens are strictly unique.
CREATE UNIQUE INDEX IF NOT EXISTS users_expo_push_token_unique
  ON users (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_fcm_token_unique
  ON users (fcm_token)
  WHERE fcm_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_apns_token_unique
  ON users (apns_token)
  WHERE apns_token IS NOT NULL;
