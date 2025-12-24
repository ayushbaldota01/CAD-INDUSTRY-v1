-- ============================================================================
-- UPDATE FILES SCHEMA FOR PROJECT SUPPORT
-- ============================================================================
-- Run this in Supabase SQL Editor

-- 1. Add project_id column to existing 'files' table
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);

-- 3. Verify column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'project_id'
    ) THEN
        RAISE NOTICE '✅ project_id added to files table successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to add project_id column';
    END IF;
END $$;
