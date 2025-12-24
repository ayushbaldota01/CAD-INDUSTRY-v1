-- ============================================================================
-- SUPABASE CONNECTION TEST SCHEMA
-- ============================================================================
-- Run this script in the Supabase SQL Editor to verify your database is working.
-- It creates a simple table and inserts a test record.

-- 1. Create a test table
CREATE TABLE IF NOT EXISTS connection_test (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE connection_test ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy that allows everyone to read (for testing purposes)
CREATE POLICY "Allow public read access" 
ON connection_test FOR SELECT 
TO public 
USING (true);

-- 4. Create a policy that allows everyone to insert (for testing purposes)
CREATE POLICY "Allow public insert access" 
ON connection_test FOR INSERT 
TO public 
WITH CHECK (true);

-- 5. Insert a test record
INSERT INTO connection_test (message) 
VALUES ('Supabase connection successful! Timestamp: ' || now());

-- 6. Select the record to verify
SELECT * FROM connection_test;
