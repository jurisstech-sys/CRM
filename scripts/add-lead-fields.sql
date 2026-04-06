-- Migration: Add separate email and phone fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email1 TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email2 TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email3 TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone1 TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone2 TEXT;

-- Migrate existing description data to new fields
-- This is a best-effort migration for leads that have contact info in description
-- Format: "📱 Tel: phone1, phone2 | 📧 Email: email1, email2, email3"
-- We'll handle this in the application code instead of SQL for safety

COMMENT ON COLUMN leads.email1 IS 'Email principal do lead';
COMMENT ON COLUMN leads.email2 IS 'Email secundário do lead';
COMMENT ON COLUMN leads.email3 IS 'Email terciário do lead';
COMMENT ON COLUMN leads.phone1 IS 'Telefone principal do lead';
COMMENT ON COLUMN leads.phone2 IS 'Telefone secundário do lead';
