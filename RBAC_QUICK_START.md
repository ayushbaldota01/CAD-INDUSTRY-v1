# Quick Start Guide - Role-Based Access Control

## 🚀 Getting Started

### Step 1: Apply Database Schema

Run this SQL in your Supabase SQL Editor:

```sql
-- The schema is in: supabase_schema.sql
-- It includes the profiles table and auto-creation trigger
```

### Step 2: Assign Roles to Users

After users sign up, update their roles in Supabase:

```sql
-- Make a user an admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';

-- Make a user a reviewer
UPDATE profiles 
SET role = 'reviewer' 
WHERE email = 'reviewer@example.com';

-- Viewer is the default (no update needed)
```

### Step 3: Test the System

#### **As Admin (👑):**
1. Login to the app
2. See purple "👑 Admin" badge in viewer
3. Can access Upload page
4. Can use all annotation tools
5. Can add comments/annotations

#### **As Reviewer (✏️):**
1. Login to the app
2. See blue "✏️ Reviewer" badge in viewer
3. **Cannot** access Upload page (shows "Access Denied")
4. Can use all annotation tools
5. Can add comments/annotations

#### **As Viewer (👁️):**
1. Login to the app
2. See gray "👁️ Viewer" badge in viewer
3. **Cannot** access Upload page (shows "Access Denied")
4. Annotation tools are **disabled** (grayed out with 🔒)
5. **Cannot** add comments/annotations
6. Can only view and navigate

## 🎨 Visual Guide

### Upload Page Access:

```
┌─────────────────────────────────────┐
│  Admin    → ✅ Can Upload Files     │
│  Reviewer → ❌ Access Denied        │
│  Viewer   → ❌ Access Denied        │
└─────────────────────────────────────┘
```

### Annotation Tools:

```
┌──────────────────────────────────────────┐
│  Tool          │ Admin │ Reviewer │ Viewer │
├──────────────────────────────────────────┤
│  Select/Orbit  │  ✅   │    ✅    │   ✅   │
│  Comment       │  ✅   │    ✅    │   🔒   │
│  Measure       │  ✅   │    ✅    │   🔒   │
│  Rev Cloud     │  ✅   │    ✅    │   🔒   │
└──────────────────────────────────────────┘
```

### Role Badge Colors:

```
👑 Admin    → Purple badge (bg-purple-500/20)
✏️ Reviewer → Blue badge (bg-blue-500/20)
👁️ Viewer   → Gray badge (bg-slate-500/20)
```

## 🔧 Common Tasks

### Change User Role:

```sql
-- Promote viewer to reviewer
UPDATE profiles SET role = 'reviewer' WHERE id = 'user-uuid';

-- Promote reviewer to admin
UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid';

-- Demote admin to viewer
UPDATE profiles SET role = 'viewer' WHERE id = 'user-uuid';
```

### Check All User Roles:

```sql
SELECT 
  email,
  full_name,
  role,
  created_at
FROM profiles
ORDER BY role, email;
```

### Count Users by Role:

```sql
SELECT 
  role,
  COUNT(*) as user_count
FROM profiles
GROUP BY role;
```

## 🐛 Troubleshooting

### Issue: User has no role badge

**Solution:** Check if profile exists:
```sql
SELECT * FROM profiles WHERE id = 'user-uuid';
```

If no profile, create one:
```sql
INSERT INTO profiles (id, email, role)
VALUES ('user-uuid', 'user@example.com', 'viewer');
```

### Issue: Annotation tools not disabled for viewer

**Solution:** Check browser console for errors. Ensure:
1. `useUserRole` hook is imported
2. `permissions.canComment` is passed to ViewerToolbar
3. User is logged in

### Issue: Upload page accessible to non-admins

**Solution:** Clear browser cache and reload. Check:
```sql
SELECT role FROM profiles WHERE id = 'user-uuid';
```

## 📝 Notes

- **Default Role:** All new users get `viewer` role
- **Role Changes:** Take effect immediately (no logout required)
- **Demo Mode:** Always defaults to `admin` role
- **Security:** Currently UI-level only (add RLS for production)

## 🎯 Next Steps

1. ✅ Test with different user accounts
2. ✅ Verify role badges appear correctly
3. ✅ Test annotation tool restrictions
4. ✅ Test upload page access control
5. 🔜 Add RLS policies for database-level security
6. 🔜 Create admin panel for role management

---

**Need Help?** Check `RBAC_SUMMARY.md` for detailed implementation docs.
