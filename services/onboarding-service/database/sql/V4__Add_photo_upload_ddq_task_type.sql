SET search_path TO onboarding, public;

ALTER TABLE ddq_pack_item
    DROP CONSTRAINT IF EXISTS ddq_pack_item_task_type_check;
