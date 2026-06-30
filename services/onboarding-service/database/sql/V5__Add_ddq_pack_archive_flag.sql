SET search_path TO onboarding, public;

ALTER TABLE ddq_pack
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
