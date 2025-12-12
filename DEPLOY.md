
# Deployment Checklist

## 1. Supabase Setup
- [ ] **Create Project**: Go to [supabase.com](https://supabase.com) and create a new project.
- [ ] **Run Migration**:
    - Open the **SQL Editor** in Supabase dashboard.
    - Copy content of `supabase_schema.sql` and run it.
    - Verify tables (`users`, `models`, `snapshots`, etc.) are created.
- [ ] **Create Storage Buckets**:
    - Go to **Storage**.
    - Create the following buckets:
        - `models` (Public or Private depending on desired access, Public is easier for viewing).
        - `snapshots` (Public recommended for easy sharing).
        - `exports` (Public recommended for easy download).
    - **Important**: Add Storage RLS policies if buckets are private, or for upload constraints. For a demo, "Public" and simple "Give Insert access to authenticated users" policies are easiest.

## 2. Environment Variables
Collect these keys:
- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings -> API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings -> API
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings -> API (service_role secret)

## 3. Deployment (Vercel)
- [ ] **Connect Repository**: Import the `cad-viewer` repo in Vercel.
- [ ] **Configure Project**:
    - Framework Preset: Next.js
    - Root Directory: `./`
- [ ] **Set Environment Variables**:
    - Add the 3 keys from step 2 in Vercel "Environment Variables" settings.
    - **Note**: `SUPABASE_SERVICE_ROLE_KEY` is crucial for the `/api` routes (snapshots, pdf-export) to bypass RLS and write to storage/db as admin.
- [ ] **Deploy**: Click Deploy.

## 4. Demo Walkthrough
1.  **Upload**: Go to `/upload`, adding a `.glb` or `.pdf`.
2.  **View**: Click the file card to enter the Viewer.
3.  **Annotate**: Click on the model/pdf to add comments/annotations.
4.  **Snapshot**: (3D only) Click "Snapshot" to capture state.
5.  **Export**: (Optional) Use Postman or curl to hit `/api/export-pdf` with the snapshot ID.
6.  **Share**: (Optional) Generate a share link (if UI implemented) or manually craft `/view/shared/[token]` after generating a token via API.

## Troubleshooting Tips

### ❌ CORS Errors (Storage)
- **Issue**: Canvas fails to load "tainted" image data or download fails.
- **Fix**: In Supabase Storage -> Bucket Settings, ensure proper CORS configuration is allowed (e.g., Allow `*` or your Vercel domain).

### ❌ Permission Denied (403)
- **Issue**: Upload fails or DB Insert fails.
- **Fix**: Check Row Level Security (RLS) policies in SQL Editor.
    - For quick start/demo: Enable "INSERT for authenticated users" or "INSERT for anon" if testing without login.
    - Ensure `SUPABASE_SERVICE_ROLE_KEY` is correctly set in Vercel for server-side operations (it bypasses RLS).

### ❌ "Model Not Found" / Images Broken
- **Issue**: URL 404s.
- **Fix**:
    - Ensure Bucket is "Public" or that you are generating signed URLs (the Shared View uses signed URLs logic).
    - Check if `file_key` in DB matches the actual path in Storage.

### ❌ Edge Function / API Timeouts
- **Issue**: PDF Generation takes too long (>10s).
- **Fix**: Vercel Serverless Functions have a timeout (usually 10s on Hobby).
    - Optimization: Optimize images before PDF generation.
    - Move heavy compute to actual Supabase Edge Functions (Deno) if Node.js runtime on Vercel is too slow.
