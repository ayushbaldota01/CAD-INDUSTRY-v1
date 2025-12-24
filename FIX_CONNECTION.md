# 🚨 CRITICAL FIX REQUIRED: Invalid Supabase URL

The error logs show that your application is trying to connect to an **invalid URL**:
`https://sb_publishable_l5bu...`

This looks like you accidentally pasted a **Publishable Key** into the **URL** field.

## 🛠️ How to Fix

1.  **Log in to Supabase Dashboard**.
2.  Go to **Project Settings** (gear icon) -> **API**.
3.  Find the **Project URL**. It should look like:
    `https://[project-ref].supabase.co`
    *(Example: `https://abcdefghijklm.supabase.co`)*
4.  Copy this URL.
5.  Open your `.env.local` file in this project.
6.  Update the `NEXT_PUBLIC_SUPABASE_URL` variable:

```env
# CURRENT (WRONG ❌)
NEXT_PUBLIC_SUPABASE_URL=https://sb_publishable_...

# NEW (CORRECT ✅)
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-ref.supabase.co
```

7.  **Save the file**.
8.  **Restart your server** (`Ctrl+C` then `npm run dev`).

## 🧪 Verification

After fixing the URL:
1.  Run the `test_schema.sql` script in Supabase SQL Editor.
2.  Try to Sign Up again in the app.
