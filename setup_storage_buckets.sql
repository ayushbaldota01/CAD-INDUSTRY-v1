-- ============================================================================
-- SETUP STORAGE BUCKETS
-- ============================================================================
-- Run this script in Supabase SQL Editor to create required storage buckets

-- Step 1: Create the cad-files bucket for 3D model uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cad-files',
    'cad-files',
    true,
    524288000, -- 500MB limit
    ARRAY['model/gltf-binary', 'application/octet-stream', 'model/stl', 'application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 2: Create the documents bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    true,
    104857600, -- 100MB limit
    ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- Step 3: Create the snapshots bucket for viewer screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'snapshots',
    'snapshots',
    true,
    10485760, -- 10MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- Step 4: Create storage policies for cad-files bucket

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload cad files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cad-files');

-- Allow anyone to view files (public bucket)
CREATE POLICY "Anyone can view cad files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cad-files');

-- Allow users to delete their own files
CREATE POLICY "Users can delete own cad files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'cad-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Step 5: Create storage policies for documents bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Anyone can view documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Step 6: Create storage policies for snapshots bucket
CREATE POLICY "Authenticated users can upload snapshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'snapshots');

CREATE POLICY "Anyone can view snapshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'snapshots');

-- Verify buckets were created
DO $$
DECLARE
    bucket_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO bucket_count FROM storage.buckets WHERE id IN ('cad-files', 'documents', 'snapshots');
    RAISE NOTICE '✅ Created % storage buckets', bucket_count;
END $$;
