# 🚀 Co-Founder's Guide: Enterprise CAD Collaboration Platform

## 1. Executive Summary
This project is a **high-performance, cloud-native CAD collaboration platform** designed for engineering teams. It bridges the gap between desktop CAD software and web-based collaboration, allowing users to upload, visualize, review, and organize 3D assets (GLB, STL) and 2D drawings (PDF) securely in the cloud.

The core value proposition is **zero-install visualization** with **enterprise-grade security** and **team-based organization**.

---

## 2. Technical Stack & Architecture

### **Frontend Core**
*   **Framework**: Next.js 14+ (App Router) - Server Side Rendering (SSR) for performance.
*   **Language**: TypeScript - Strict type safety for complex data structures.
*   **Styling**: Tailwind CSS - Utility-first styling for a premium, responsive UI.
*   **UI Components**: Lucide React (Icons), React Dropzone (Uploads).

### **Visualization Engine (The "Secret Sauce")**
*   **Core**: Three.js (WebGL renderer).
*   **React Integration**: `@react-three/fiber` (R3F) for declarative scene management.
*   **Helpers**: `@react-three/drei` for camera controls (`OrbitControls`), environment lighting (`Environment`), and loaders (`useGLTF`, `useSTL`).
*   **Performance**: Dracosis compression support (via GLTFLoader).

### **Backend Infrastructure**
*   **Platform**: Supabase (BaaS).
*   **Database**: PostgreSQL 15+ with `pgvector` support (future proofing).
*   **Auth**: Supabase Auth (JWT-based, supports Email/Password + OAuth).
*   **Storage**: S3-compatible object storage for large CAD files.
*   **Security**: Row Level Security (RLS) enforcement at the database layer.

---

## 3. Database Schema (The Source of Truth)

The data model centers around **Users**, **Projects**, and **Files**.

### **Core Tables**

1.  **`profiles`**: Extends auth users with app-specific roles (`admin`, `reviewer`, `viewer`).
2.  **`projects`**: Workspaces for collaboration.
    *   `id` (UUID), `name`, `created_by`.
3.  **`project_members`**: Link table for team access.
    *   `project_id`, `user_id`, `role` (owner/admin/member).
4.  **`files`**: The central asset inventory.
    *   `id`, `name`, `type` (glb/stl/pdf), `storage_path`, `version`.
    *   `project_id` (FK to projects) - **Crucial for organization**.
    *   `created_by` (FK to auth.users).

### **Storage Architecture**

*   **Bucket**: `cad-files`
*   **Folder Structure**:
    *   **Personal Files**: `[user_id]/[timestamp]_[filename]`
    *   **Project Files**: `[project_id]/[timestamp]_[filename]`

---

## 4. Feature Specifications (The "Recipe")

### **A. Authentication & RBAC (Role-Based Access Control)**
*   **Mechanism**: Users sign up via Supabase Auth. A trigger automatically creates a `profile` entry.
*   **Hooks**: `useUserRole()` hook fetches profile data to gate UI features (e.g., only admins can delete).
*   **Security**: RLS policies prevent users from querying data they don't own or accept.

### **B. 3D Viewer Module**
*   **Component**: `CadViewer.tsx`
*   **Logic**:
    1.  Receives file URL (signed URL from Supabase Storage).
    2.  Determines loader type (GLTF vs STL).
    3.  Renders `<Canvas>` with `<Stage>` for auto-lighting and centering.
    4.  Adds `<OrbitControls>` for user interaction (rotate/pan/zoom).
    5.  **Critical**: Handles loading states (`<Suspense>`) and error boundaries for corrupt files.

### **C. Secure Upload & Organization**
*   **Component**: `UploadPage.tsx`
*   **Workflow**:
    1.  **Validation**: Checks file size (500MB limit), extension, and sanitizes filename.
    2.  **Project Selection**: User selects a target Project from dropdown.
    3.  **Upload Phase**: Uploads binary data to Storage Bucket (`cad-files`) under the specific folder ID.
    4.  **Metadata Phase**: Inserts record into `files` table via `/api/upload` endpoint, linking the file to the `project_id`.

### **D. Dashboard & Project Management**
*   **Component**: `Home` (`page.tsx`) & `ProjectList`
*   **Logic**: Authentication check -> Fetch User's Projects -> Fetch Recent Files (JOIN `projects` table for context).
*   **Feature**: Displays a grid/list of assets with smart tags showing which project they belong to.

---

## 5. Build Recipe: From Zero to Prototype

If you were to rebuild this from scratch, follow this exact sequence:

### **Step 1: Foundation Setup**
1.  Initialize Next.js App (`npx create-next-app@latest`).
2.  Install Dependencies: `npm install three @types/three @react-three/fiber @react-three/drei @supabase/supabase-js`.
3.  Configure tailwind.config.js for consistent styling tokens.

### **Step 2: Database Initialization (Run in Supabase SQL Editor)**
Run these SQL scripts in order (files included in repo):
1.  **`supabase_schema.sql`**: Sets up `profiles`, `files` tables.
2.  **`team_collaboration_schema.sql`**: Adds `projects` and `project_members`.
3.  **`add_project_to_files.sql`**: Links files to projects.
4.  **`fix_rls_policies.sql`**: secures access (crucial for recursion fix).
5.  **`setup_storage_buckets.sql`**: Creates `cad-files` bucket with upload policies.

### **Step 3: Backend Logic (API Routes)**
1.  Create `/api/upload/route.ts`:
    *   Handle POST requests.
    *   Validate inputs.
    *   Insert into DB.
    *   Return success/failure JSON.

### **Step 4: Frontend Implementation**
1.  **`lib/supabaseClient.ts`**: Single instance configuration.
2.  **`src/hooks/*`**: Encapsulate logic (`useAuth`, `useProjects`).
3.  **`src/app/upload/page.tsx`**: Build the drag-and-drop zone with project selector.
4.  **`src/components/CadViewer.tsx`**: Build the Three.js scene.

---

## 6. Future Scalability Roadmap

To take this from Prototype to **Enterprise Product**:

1.  **Versioning v2**: Implement file version history (v1, v2, v3) with "Diff View" (overlaying two models to see changes).
2.  **Real-Time Collaboration**: Use Supabase Realtime to show live cursors and annotations on the 3D model (like Figma for CAD).
3.  **Format Conversion**: A server-side queue (BullMQ + Redis) to convert extensive formats (STEP, IGES, OBJ) into GLB for web optimization on upload.
4.  **Team Permissions**: Granular access control (Edit vs View vs Comment access) per project.

---
*Generated by Antigravity - Senior Agentic Coding Assistant*
