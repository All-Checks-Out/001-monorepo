SET search_path TO onboarding, public;

ALTER TABLE form_templates
    DROP CONSTRAINT IF EXISTS form_templates_schema_version_check,
    ADD CONSTRAINT form_templates_schema_version_check
        CHECK ((schema_json->>'version') IS NOT NULL);
