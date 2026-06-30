CREATE TABLE IF NOT EXISTS document_analysis.document_projection (
    evidence_id INT PRIMARY KEY,
    checklist_task_id INT NOT NULL,
    provider_corporation_id INT NOT NULL,
    uploaded_by_app_user_id INT NOT NULL,
    bucket_name TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    upload_time_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    upload_requested_at TIMESTAMPTZ NULL,
    object_created_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_analysis.analysis_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id INT NOT NULL,
    object_key TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    CONSTRAINT analysis_job_status_check
        CHECK (status IN ('completed', 'skipped'))
);

CREATE TABLE IF NOT EXISTS document_analysis.analysis_tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_job_id UUID NOT NULL
        REFERENCES document_analysis.analysis_job(id)
        ON DELETE CASCADE,
    evidence_id INT NOT NULL,
    tag TEXT NOT NULL,
    confidence NUMERIC(5,2) NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT analysis_tag_source_check
        CHECK (source IN ('aws-rekognition')),
    CONSTRAINT analysis_tag_not_blank
        CHECK (LENGTH(TRIM(tag)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_analysis_tag_evidence
    ON document_analysis.analysis_tag(evidence_id);

CREATE TABLE IF NOT EXISTS document_analysis.analysis_event_inbox (
    event_id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    evidence_id INT NULL,
    object_key TEXT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
