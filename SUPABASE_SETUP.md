# Supabase Setup Instructions

## ✅ Mock Mode Disabled - Using Real Supabase

The application is now configured to use your Supabase project.

## 📋 Required Steps

### 1. Run SQL Schemas in Supabase

Go to your Supabase Dashboard → SQL Editor and run these files **in order**:

#### A. Main Schema (`supabase_schema.sql`)
```sql
-- Run the entire contents of supabase_schema.sql
-- This creates: profiles, models, files, activity_logs, etc.
```

#### B. Team Collaboration Schema (`team_collaboration_schema.sql`)
```sql
-- Run the entire contents of team_collaboration_schema.sql  
-- This creates: projects, project_members, team_invitations
```

### 2. Create Storage Buckets

In Supabase Dashboard → Storage, create these buckets:

- **`cad-files`** - For CAD model uploads (GLB, STL)
- **`documents`** - For PDF documents
- **`snapshots`** - For viewer screenshots

**Bucket Settings:**
- Public: Yes (or configure RLS policies)
- File size limit: 500MB
- Allowed MIME types: `model/gltf-binary`, `application/pdf`, `image/*`

### 3. Enable Realtime (Optional)

In Supabase Dashboard → Database → Replication:
- Enable realtime for: `activity_logs`, `annotations`, `comments`

### 4. Verify Environment Variables

Your `.env.local` should have:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

## 🧪 Testing

1. **Sign Up**: Go to `/signup` and create an account
2. **Verify Email**: Check your email for verification link
3. **Login**: Go to `/login` with your credentials
4. **Create Project**: Go to `/projects` and create a project
5. **Upload File**: Go to `/upload` and upload a GLB file

## 🐛 Troubleshooting

**"Not authenticated" errors:**
- Make sure you've signed up and verified your email
- Check browser console for auth errors

**"Table does not exist" errors:**
- Run the SQL schemas in Supabase SQL Editor
- Check that all tables were created successfully

**"Storage bucket not found" errors:**
- Create the storage buckets in Supabase Dashboard
- Make sure bucket names match exactly

**"RLS policy" errors:**
- The SQL schemas include RLS policies
- If issues persist, temporarily disable RLS for testing

## 📊 Database Structure

After running the schemas, you should have:

**Auth & Users:**
- `auth.users` (Supabase managed)
- `profiles` (user profiles with roles)

**Files & Models:**
- `files` (file metadata)
- `models` (3D model data)
- `cad_files` (CAD file records)

**Collaboration:**
- `projects` (team workspaces)
- `project_members` (team membership)
- `team_invitations` (pending invites)

**Activity:**
- `activity_logs` (user actions)
- `annotations` (3D annotations)
- `comments` (discussions)

## 🎯 Next Steps

Once everything is set up:
1. Test authentication flow
2. Create a project
3. Upload a CAD file
4. Invite team members
5. Test collaboration features

Good luck! 🚀
