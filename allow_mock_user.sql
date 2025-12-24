-- TEMPORARY: Relax constraints for testing
-- Run this in Supabase SQL Editor

-- 1. Disable RLS temporarily or make it permissive
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

-- 2. Drop the foreign key constraint on created_by (so we can use mock IDs)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

-- 3. Make created_by nullable (optional, but good for flexibility)
ALTER TABLE projects ALTER COLUMN created_by DROP NOT NULL;

-- 4. Drop trigger that auto-adds owner (since it relies on foreign keys)
DROP TRIGGER IF EXISTS on_project_created ON projects;

-- 5. Add a permissive policy just in case RLS is re-enabled
CREATE POLICY "Public Access" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON project_members FOR ALL USING (true) WITH CHECK (true);
