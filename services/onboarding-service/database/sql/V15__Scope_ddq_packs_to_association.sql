SET search_path TO onboarding, public;

ALTER TABLE ddq_pack
    ADD COLUMN IF NOT EXISTS association_corporation_id INT;

WITH owning_association AS (
    SELECT id
      FROM corporation
     WHERE type = 'ASSOCIATION'
     ORDER BY CASE WHEN status = 'approved' THEN 0 ELSE 1 END,
              id
     LIMIT 1
)
UPDATE ddq_pack
   SET association_corporation_id = (SELECT id FROM owning_association)
 WHERE association_corporation_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM ddq_pack
         WHERE association_corporation_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot scope existing DDQ Packs because no Association corporation exists.';
    END IF;
END $$;

ALTER TABLE ddq_pack
    ALTER COLUMN association_corporation_id SET NOT NULL,
    ADD CONSTRAINT ddq_pack_association_corporation_fk
        FOREIGN KEY (association_corporation_id)
        REFERENCES corporation(id)
        ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ddq_pack_association_corporation_idx
    ON ddq_pack(association_corporation_id, created_at DESC, id DESC);
