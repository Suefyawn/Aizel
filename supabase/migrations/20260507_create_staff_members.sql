-- Staff members table for role-based admin access
CREATE TABLE IF NOT EXISTS staff_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        UNIQUE NOT NULL,
  name          text        NOT NULL,
  permissions   text[]      NOT NULL DEFAULT '{}',
  password_hash text        NOT NULL,
  password_salt text        NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast login lookup
CREATE INDEX IF NOT EXISTS staff_members_email_idx ON staff_members (email);
