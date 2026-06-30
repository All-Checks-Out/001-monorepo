SET search_path TO onboarding, public;

ALTER TABLE corporation_application
ADD COLUMN IF NOT EXISTS provider_corporation_id INT NULL;

ALTER TABLE corporation_application
ADD CONSTRAINT corporation_application_provider_fk
FOREIGN KEY (provider_corporation_id)
REFERENCES corporation(id)
ON DELETE CASCADE;
