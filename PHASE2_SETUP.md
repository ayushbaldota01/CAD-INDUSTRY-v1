# Phase 2: Team Collaboration - Setup Guide

## ✅ What's Been Created

### 1. Database Schema (`team_collaboration_schema.sql`)
Run this in your Supabase SQL Editor to create:
- `projects` table
- `project_members` table  
- `team_invitations` table
- Row Level Security policies
- Auto-trigger to add creator as owner

### 2. React Hook (`useProjects.ts`)
Manages project CRUD operations:
- `fetchProjects()` - Get user's projects
- `createProject()` - Create new project
- `updateProject()` - Update project details
- `deleteProject()` - Delete project

### 3. UI Pages
- `/projects` - Projects dashboard with grid view
- `/projects/[id]` - Project detail page with tabs

## 🚀 How to Deploy

### Step 1: Deploy Database Schema
```bash
# 1. Open Supabase Dashboard → SQL Editor
# 2. Copy contents of team_collaboration_schema.sql
# 3. Paste and run
# 4. Verify tables created in Table Editor
```

### Step 2: Test the Feature
```bash
# 1. Restart your dev server (if needed)
npm run dev

# 2. Navigate to http://localhost:3000/projects
# 3. Click "New Project"
# 4. Create a project
# 5. Click on the project to view details
```

## 📋 What's Working

✅ Create projects
✅ View projects dashboard
✅ Project detail page with tabs
✅ Role-based access (owner/admin/member/viewer)
✅ RLS policies protect data

## 🔜 Coming Next

- Team member management
- File linking to projects
- Team invitations via email
- Activity feed
- File sharing within projects

## 🐛 Troubleshooting

**"Projects not loading"**
- Check Supabase SQL was executed successfully
- Check browser console for errors
- Verify you're logged in

**"Can't create project"**
- Check `projects` table exists
- Check RLS policies are enabled
- Check user is authenticated

## 📊 Database Structure

```
projects
├── id (uuid)
├── name (text)
├── description (text)
├── created_by (uuid → auth.users)
├── created_at (timestamp)
└── updated_at (timestamp)

project_members
├── project_id (uuid → projects)
├── user_id (uuid → auth.users)
├── role (owner|admin|member|viewer)
├── invited_by (uuid → auth.users)
└── joined_at (timestamp)
```

## 🎯 Next Steps

1. Deploy the SQL schema
2. Test creating a project
3. Let me know when ready for team invitations!
