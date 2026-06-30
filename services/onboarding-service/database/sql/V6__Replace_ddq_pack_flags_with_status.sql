SET search_path TO onboarding, public;

ALTER TABLE ddq_pack
    ADD COLUMN IF NOT EXISTS status VARCHAR(32);

UPDATE ddq_pack
   SET status = CASE
        WHEN COALESCE(is_archived, FALSE) THEN 'archived'
        WHEN is_published THEN 'published'
        ELSE 'draft'
   END
 WHERE status IS NULL;

ALTER TABLE ddq_pack
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'draft',
    ADD CONSTRAINT ddq_pack_status_check
        CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE ddq_pack
    DROP COLUMN IF EXISTS is_published,
    DROP COLUMN IF EXISTS is_archived;
