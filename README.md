# CAD Viewer Project

A beginner-friendly Next.js application for reviewing CAD (3D) and PDF files, powered by Supabase.

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **3D Rendering**: React Three Fiber (Three.js)
- **PDF Rendering**: PDF.js / pdf-lib
- **Backend/DB**: Supabase (Postgres, Storage, Auth, Realtime)

## Prerequisites

1.  **Node.js**: Install v18+
2.  **Supabase Project**:
    *   Create a new project at [supabase.com](https://supabase.com).
    *   Get your `Project URL` and `anon public key`.
    *   Create a Storage Bucket named `cad-files` (public or private).
    *   (Optional) Set up a `files` table in Database to track uploads.

## Environment Variables

Create a file named `.env.local` in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Server-side only (if needed for admin tasks)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run the development server**:
    ```bash
    npm run dev
    ```

3.  **Open the app**:
    Navigate to [http://localhost:3000](http://localhost:3000).

## Project Structure

- `/app`: Next.js App Router pages and layouts.
    - `page.tsx`: Dashboard (list of files).
    - `upload/`: Upload page.
    - `view/[id]/`: File viewer page (dynamic route).
- `/components`: Reusable UI components (Viewers, Buttons).
- `/lib`: Utility functions (Supabase client).
- `/public`: Static assets.

## TODOs & Roadmap

- [ ] Connect `upload/page.tsx` to Supabase Storage.
- [ ] Implement `PDFViewer` using `pdfjs-dist` or `react-pdf`.
- [ ] Implement `ThreeViewer` using `@react-three/fiber` to load GLB/gLTF files.
- [ ] Add Auth protection to Upload/View routes.

## Running Tests
Run the unit tests for projection logic:
```bash
npx jest
```

## Demo Script
Follow these steps to demonstrate the full feature set:

1.  **Setup**:
    *   Ensure Supabase is running and `.env.local` is configured.
    *   Run `npm run dev`.

2.  **Upload Model**:
    *   Navigate to `/upload`.
    *   Upload `samples/Box.glb` (or any GLB file).

3.  **View & Annotate**:
    *   Click on the uploaded model to view it.
    *   Click anywhere on the model to add a 3D annotation (e.g., "Test Point").
    *   Rotate the camera to a desired angle.

4.  **Take Snapshot**:
    *   Click the **Snapshot** button in the header.
    *   Wait for the alert confirming the snapshot URL.

5.  **Export Report**:
    *   (Optional) Use Postman to call `/api/export-pdf` with the returned snapshot ID to generate a PDF report.

6.  **Annotate PDF**:
    *   Navigate to `/annotate` to test the PDF overlay tools on a sample document.
    *   Draw arrows or text and click **Save Overlay**.
