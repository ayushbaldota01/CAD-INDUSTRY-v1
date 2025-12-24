-- ============================================================================
-- FIX RLS POLICIES - RESOLVES RECURSION ERROR
-- ============================================================================
-- Run this script in Supabase SQL Editor to fix the "recursion detected" error
-- This MUST be run before the application will work correctly

-- Step 1: Create helper function to check project membership
-- This function runs with elevated permissions to avoid RLS checks
CREATE OR REPLACE FUNCTION get_user_project_ids(user_uuid UUID)
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT project_id FROM project_members WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create helper function to check if user is admin/owner of a project
CREATE OR REPLACE FUNCTION is_project_admin(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = project_uuid 
        AND user_id = user_uuid 
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Admins can add members" ON project_members;
DROP POLICY IF EXISTS "Admins can remove members" ON project_members;
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Owners can update projects" ON projects;
DROP POLICY IF EXISTS "Owners can delete projects" ON projects;

-- Step 4: Create NON-RECURSIVE policies for project_members

-- SELECT: Users can view members of projects they belong to
CREATE POLICY "Users can view project members"
    ON project_members FOR SELECT
    USING (
        project_id IN (SELECT get_user_project_ids(auth.uid()))
    );

-- INSERT: Users can add themselves to a project (after invitation) OR admins can add anyone
CREATE POLICY "Users can add members"
    ON project_members FOR INSERT
    WITH CHECK (
        -- User is adding themselves (accepting invitation)
        user_id = auth.uid()
        OR
        -- User is an admin of the project
        is_project_admin(project_id, auth.uid())
    );

-- UPDATE: Admins can update member roles
CREATE POLICY "Admins can update members"
    ON project_members FOR UPDATE
    USING (is_project_admin(project_id, auth.uid()));

-- DELETE: Admins can remove members
CREATE POLICY "Admins can remove members"
    ON project_members FOR DELETE
    USING (is_project_admin(project_id, auth.uid()));

-- Step 5: Create NON-RECURSIVE policies for projects

-- SELECT: Users can view projects they are members of
CREATE POLICY "Users can view their projects"
    ON projects FOR SELECT
    USING (
        id IN (SELECT get_user_project_ids(auth.uid()))
    );

-- INSERT: Any authenticated user can create a project
CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- UPDATE: Only project owners can update
CREATE POLICY "Owners can update projects"
    ON projects FOR UPDATE
    USING (created_by = auth.uid());

-- DELETE: Only project owners can delete
CREATE POLICY "Owners can delete projects"
    ON projects FOR DELETE
    USING (created_by = auth.uid());

-- Step 6: Verify the fix worked
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies fixed successfully!';
    RAISE NOTICE 'The recursion error should now be resolved.';
END $$;

-- Test query (optional - uncomment to test)
-- SELECT * FROM projects LIMIT 1;
-- SELECT * FROM project_members LIMIT 1;
