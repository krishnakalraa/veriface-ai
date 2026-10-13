-- ==============================================================================
-- VeriFace AI — Supabase PostgreSQL Database Schema
--
-- This script provisions the required tables, indexes, constraints, and Row-Level
-- Security (RLS) policies for VeriFace AI. Run this in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Master Registry: `people` table
-- Stores canonical identity records cross-referenced during Layer 4 verification.
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_number VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    dob VARCHAR(32) NOT NULL,
    document_type VARCHAR(64) NOT NULL DEFAULT 'campus_id',
    institution_id VARCHAR(128),
    photo_reference TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Require an uploaded image data URL for all new or updated registry rows.
-- NOT VALID keeps existing rows available for remediation without allowing
-- new rows to omit a biometric photo.
ALTER TABLE public.people
    DROP CONSTRAINT IF EXISTS people_photo_reference_image_check;
ALTER TABLE public.people
    ADD CONSTRAINT people_photo_reference_image_check
    CHECK (photo_reference IS NOT NULL AND photo_reference LIKE 'data:image/%') NOT VALID;

-- Index for instant Layer 4 ID lookups
CREATE INDEX IF NOT EXISTS idx_people_id_number ON public.people (id_number);
CREATE INDEX IF NOT EXISTS idx_people_document_type ON public.people (document_type);
CREATE INDEX IF NOT EXISTS idx_people_institution_id ON public.people (institution_id);

-- 3. Audit Ledger: `verification_logs` table
-- Stores every completed verification run with trust score, decision, and SHA-256 hash.
CREATE TABLE IF NOT EXISTS public.verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode VARCHAR(64) NOT NULL,
    doc_type VARCHAR(64),
    id_number VARCHAR(64),
    name VARCHAR(255),
    face_match BOOLEAN,
    distance NUMERIC(6, 4),
    ocr_passed BOOLEAN,
    db_found BOOLEAN,
    trust_score NUMERIC(5, 2) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    mismatched_fields JSONB DEFAULT '[]'::jsonb,
    record_hash VARCHAR(64),
    blockchain_anchor_tx VARCHAR(128),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for audit filtering, temporal queries, and anomaly analytics
CREATE INDEX IF NOT EXISTS idx_vlogs_timestamp ON public.verification_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vlogs_decision ON public.verification_logs (decision);
CREATE INDEX IF NOT EXISTS idx_vlogs_id_number ON public.verification_logs (id_number);
CREATE INDEX IF NOT EXISTS idx_vlogs_trust_score ON public.verification_logs (trust_score);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

-- 5. Define Public / Anon Access Policies for Demo & Testing
-- Allow anon client to read, insert, update, and delete registry records
DROP POLICY IF EXISTS "Allow anon full access to people" ON public.people;
CREATE POLICY "Allow anon full access to people"
    ON public.people
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Allow anon client to read and insert verification audit logs
DROP POLICY IF EXISTS "Allow anon full access to verification_logs" ON public.verification_logs;
CREATE POLICY "Allow anon full access to verification_logs"
    ON public.verification_logs
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Trigger for updating `updated_at` column automatically
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_people_updated_at ON public.people;
CREATE TRIGGER trigger_set_people_updated_at
    BEFORE UPDATE ON public.people
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- Schema ready. Next step: Run `node scripts/seed.js` to populate demo data.
-- ==============================================================================
