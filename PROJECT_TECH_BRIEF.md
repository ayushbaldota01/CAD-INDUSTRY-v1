# CAD Industry Platform — Technical Brief
**For: Client Presentation · Version: 2.0 · Date: Feb 2026**

> This document covers every technology used in this platform, what it is,
> why we chose it, and what it specifically does in the application.
> Use this as a reference when explaining the system to technical stakeholders.

---

## 1. What This Platform Is

This is a **web-based engineering drawing review and annotation platform**. It allows QA engineers and design reviewers to:

- Upload and view 2D engineering drawings (PDF format) and 3D CAD models (GLB/STL)
- Place numbered **balloons** on drawings — the industry-standard way to mark inspection points
- Automatically detect engineering entities like dimensions, tolerances, GD&T symbols, thread callouts from vector PDFs
- Collaborate with team members via shared review links
- Export annotated inspection reports to Excel (`.xlsx`)
- Maintain a full audit trail of all activity

The platform is entirely **browser-based** — no desktop software installation required. Any device with a modern browser on the same network can open and review drawings.

---

## 2. Technology Stack Overview

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | Next.js | 16.0.9 |
| UI Language | TypeScript + React | 19 |
| Styling | Tailwind CSS | v4 |
| 3D Rendering | Three.js + React Three Fiber | r182 |
| PDF Engine | PDF.js (pdfjs-dist) | 3.11 |
| PDF Manipulation | pdf-lib | 1.17 |
| Database + Auth | Supabase (PostgreSQL) | 2.87 |
| File Storage | Supabase Storage | — |
| Excel Export | SheetJS (xlsx) | 0.18.5 |
| Icon Library | Heroicons | 2.2 |
| ID Generation | UUID v4 | 13 |
| Drag & Drop | react-dropzone | 14 |
| Build Tool | Webpack (via Next.js) | — |

---

## 3. Frontend Framework — Next.js 16

### What it is
Next.js is a **React framework** built by Vercel. It wraps around React and adds routing, server-side rendering, API routes, and build optimization out of the box.

### Why we chose it
- It allows writing **both frontend pages and backend API endpoints in the same codebase** — no separate Express server needed
- **App Router** gives file-based routing: `src/app/view/[id]/page.tsx` automatically becomes the URL `/view/abc-123`
- Built-in **TypeScript support** with zero configuration
- **Server Components** mean certain data-heavy pages load faster because they render on the server before sending HTML to the browser

### What it does in this project
- Powers all page routing: `/login`, `/projects`, `/view/[id]`, `/annotate`, `/share/[token]`
- Hosts the **API layer** at `src/app/api/` — each folder is a REST endpoint:
  - `/api/upload` — handles file uploads to Supabase Storage
  - `/api/export-balloons` — generates `.xlsx` reports on the server
  - `/api/export-pdf` — flattens annotations into a PDF for download
  - `/api/share` — creates and validates secure share tokens
  - `/api/snapshots` — saves 3D camera state screenshots
  - `/api/files/[id]/versions` — manages file versioning
- Runs the **dev server** locally on `http://localhost:3000`

---

## 4. Language — TypeScript

### What it is
TypeScript is **JavaScript with types**. It adds a compile-time type checker that catches errors before the code runs.

### Why we chose it
For an engineering tool where data accuracy matters (balloon numbers, coordinates, tolerances), having types on every data structure means:
- If you try to store a string where a number is expected, the build fails with a clear error
- Every `PDFOverlayItem` (a balloon or annotation) has a strictly defined shape — balloon number, position, entity type, leader line offset, confidence, etc.
- Refactors are safe: rename a field and TypeScript shows every single place it's used

### What it does in this project
The central type definition lives at `src/types/index.ts`. The key type is:

```typescript
PDFOverlayItem {
  id: string           // UUID — unique row in DB
  type: 'callout' | 'comment' | 'issue' | 'dimension' | 'freehand' | 'arrow' | 'highlight'
  points: {x,y}[]     // normalized 0..1 coordinates on PDF canvas
  balloonNo?: number   // shown inside the balloon circle
  entityType?:         // 'Dimension' | 'Tolerance' | 'GD&T' | 'Surface Finish' | ...
  leaderOffset?:       // {x,y} normalized offset of balloon from anchor
  confidence?:         // 0..1 score from auto-detection engine
  autoDetected?:       // whether balloon was placed by AI or manually
  sourceText?:         // raw text from PDF that triggered auto-detection
  ...
}
```

---

## 5. UI Styling — Tailwind CSS v4

### What it is
Tailwind is a **utility-first CSS framework**. Instead of writing separate `.css` files, you apply style classes directly in HTML: `className="flex items-center bg-slate-900 rounded-xl p-4"`.

### Why we chose it
- Extremely fast to build UI — no context switching between files
- Consistent design tokens (spacing, colors, shadows) across all components
- Dark-mode-first design is trivial: `dark:bg-slate-800`
- Tailwind v4 uses a new CSS-based config (no `tailwind.config.js` needed)

### What it does in this project
Every visual component — the toolbar, balloon list sidebar, modal dialogs, loading spinners, the annotation overlay SVG — is styled with Tailwind classes. No external UI component library (like Material UI or Chakra) is used; everything is hand-crafted for this specific use case.

---

## 6. 3D Viewer — Three.js + React Three Fiber + Drei

### What Three.js is
Three.js is the industry-standard **WebGL rendering library** for JavaScript. It abstracts raw WebGL (GPU drawing commands) into a usable API. It handles 3D geometry, materials, lights, cameras, and the render loop.

### What React Three Fiber is
React Three Fiber (R3F) is a **React wrapper for Three.js**. Instead of imperative Three.js code like `scene.add(mesh)`, you write declarative React JSX like `<mesh><boxGeometry /><meshStandardMaterial /></mesh>`. It keeps the 3D scene in sync with React state.

### What Drei is
Drei (`@react-three/drei`) is a **helper library for R3F** containing pre-built components: orbit controls, environment maps, measurement helpers, shadow casters, etc.

### What they do in this project
Located in `src/components/engine/`:
- **`CadViewer.tsx`** — the main 3D scene: camera setup, lighting, environment, orbit controls
- **`ModelLoader.tsx`** — loads GLB and STL files from Supabase Storage URLs, handles materials, geometry optimization
- **`Annotations.tsx`** — renders 3D annotation markers (pins) in the scene at real-world 3D positions
- **`Measurements.tsx`** — renders measurement lines between two clicked 3D points, calculates real-world distance using ray-casting
- **`ClippingPlanes.tsx`** — cross-section tool that slices the 3D model with a movable plane
- **`geometryUtils.ts`** — geometry math: bounding boxes, surface normal calculation, mesh BVH acceleration
- **`SceneSetup.tsx`** — lights: ambient, directional, hemisphere for realistic material shading

The 3D viewer supports GLB (GLTF binary — the modern standard for production 3D assets) and STL (legacy triangular mesh format used by most CAD exports).

### Three-mesh-bvh
BVH stands for **Bounding Volume Hierarchy** — a spatial index for 3D geometry. Without it, ray-casting (mouse click → 3D surface hit detection) on a complex CAD model with 100,000+ triangles would check every triangle, causing lag. BVH pre-sorts geometry into a tree so a ray only checks ~20 nodes. This makes click-to-annotate on complex models instant.

---

## 7. PDF Engine — PDF.js (pdfjs-dist)

### What it is
PDF.js is **Mozilla's open-source PDF renderer** — the same engine inside Firefox. It parses the PDF binary format and renders pages onto an HTML `<canvas>` element using JavaScript. No server-side rendering, no native plugins.

### Why we chose it
- Runs entirely in the browser — no PDFs are re-uploaded to a server for rendering
- Provides programmatic access to the PDF's internal text layer — actual character positions and bounding boxes, not just a rasterized image
- Free, open-source, actively maintained by Mozilla

### What it does in this project

**Rendering** (`src/components/PdfAnnotator.tsx`):
- Opens the PDF URL from Supabase Storage directly
- Renders each page to a `<canvas>` at the correct DPI (including HiDPI/Retina support via `devicePixelRatio`)
- Calculates the fit-to-screen scale so the drawing fills the viewer without scrollbars

**Text Extraction** (`src/lib/autoBalloon.ts`):
- Calls `page.getTextContent()` which returns every text item in the PDF with pixel coordinates, bounding box width/height, and transformation matrix
- This is only possible with **vector PDFs** (PDFs exported from CAD software like AutoCAD, SolidWorks, CATIA). Scanned PDFs are just rasterized images — no text layer exists, so auto-balloon correctly tells the user it cannot proceed.
- Each text item includes: raw string, `transform[4]` (X position), `transform[5]` (Y position)

---

## 8. Auto-Balloon Engine — `src/lib/autoBalloon.ts`

This is entirely **custom-built** — no third-party library. It's the core intelligence of the product.

### How it works (5-step pipeline):

**Step 1 — Text Extraction**
Uses PDF.js to pull all text items from the PDF page. Each item has pixel coordinates and dimensions.

**Step 2 — Text Merging**
PDF.js often splits a single dimension like `Ø 10.5 ±0.2` into 3 or 4 separate text fragments (because of font changes, subscript characters, or spacing). The merge algorithm:
- Groups items by Y-coordinate (same horizontal line = within 4px vertically)
- Merges adjacent items if the horizontal gap between them is ≤ 8px
- Inserts a space when the gap is visible (> 1px), so `NOTE 1` stays as `NOTE 1`, not `NOTE1`
- Recalculates the merged bounding box

**Step 3 — Classification**
Each merged text item is tested against a library of **regex patterns** organized by engineering entity type:

| Entity Type | Example matches |
|---|---|
| Dimension | `Ø10.5`, `DIA 25`, `R5`, `1.750` |
| Tolerance | `±0.05`, `+0.02/-0.01`, `H7/g6`, `10H7` |
| Thread | `M12×1.5`, `M10-6H`, `UNC`, `UNF` |
| GD&T | `⊥`, `∥`, `○`, `⌭`, `GD&T` |
| Surface Finish | `Ra 1.6`, `Rz 6.3`, `▽▽` |
| Weld | `WELD`, `FILLET WELD` |
| Material | `SS316`, `EN8`, `AISI 4140`, `HRC 58` |
| Note | `NOTE 1`, `NOTES:`, `GENERAL TOLERANCE` |

Each category has a confidence score (0.0–1.0). Diameter is highest confidence (0.95); bare numbers lowest (0.6).

**Step 4 — Proximity Deduplication**
If two detected items of the same type are within ~12px of each other (normalized to 1200×900 viewport), keep only the one with higher confidence. This removes duplicates from overlapping text fragments.

**Step 5 — Balloon Number Assignment**
Assigns sequential balloon numbers starting after the count of manually placed balloons, so auto-detected balloons never overwrite existing ones.

---

## 9. PDF Annotation Canvas — `src/components/PdfAnnotator.tsx`

This is the largest file in the project (~1,250 lines) and the primary user interaction surface.

### Architecture
The annotation overlay is an **SVG element** positioned exactly on top of the PDF canvas. All annotations are rendered as SVG shapes:
- Balloon = `<circle>` (the balloon) + `<line>` (leader) + `<circle>` (anchor dot) + `<text>` (balloon number)
- Freehand = `<path>`
- Arrow = `<line>` with SVG marker
- Highlight = `<rect>` with opacity
- Dimension = `<line>` + end `<circle>` × 2 + `<text>`

### Coordinate System
All annotation positions are stored as **normalized coordinates** (0.0 to 1.0) — not pixels. This means a balloon at `{x: 0.5, y: 0.3}` is always at the horizontal center, 30% from the top, regardless of zoom level, screen resolution, or viewport size. When rendering, multiply by canvas width/height to get pixels.

**Why normalized?** If you stored pixel coordinates, the annotation would drift when the user zooms or resizes the window. Normalized coordinates stay accurate forever.

### Zoom & Pan
- **Scroll wheel** → zooms 1.1× or 0.9× per tick, clamped between 0.25× and 5×
- Zoom is implemented as CSS `transform: scale(zoomLevel)` on the container div
- Zoom target is calculated so the point **under the cursor stays visually fixed** (standard behavior in all CAD tools)
- **Left drag on empty canvas** → pans (standard select tool behavior)
- **Middle mouse button** → also pans (power user shortcut)
- Implemented as CSS `transform: translate(panX, panY) scale(zoom)` — GPU-accelerated, never causes re-render of annotations

### Leader Line Dragging
Each balloon has a drag handle (small circle) visible when the balloon is selected. Dragging it:
1. Records start mouse position and current `leaderOffset`
2. On every `mousemove`, computes normalized delta; updates live preview state
3. On `mouseup`, calls `onUpdateLeader(id, newOffset)` → persists to Supabase

### Inline Input Panels
All user input uses custom inline floating panels (no `window.prompt` or `window.alert`):
- **Balloon text input** — appears where you clicked, textarea with Enter to confirm
- **Calibration input** — appears after drawing a calibration line, asks for known distance in mm

---

## 10. Database — Supabase (PostgreSQL)

### What Supabase is
Supabase is an **open-source Firebase alternative** built on PostgreSQL. It provides:
- A fully managed PostgreSQL relational database
- Authentication service (email/password, magic links, OAuth)
- File storage (S3-compatible object storage)
- Real-time subscriptions
- Auto-generated REST API from the database schema

### Why we chose it
- PostgreSQL's **JSONB column type** is ideal for annotation data: the `position` column stores the full annotation metadata (balloon number, entity type, leader offset, confidence, etc.) as a flexible JSON blob, while keeping relational integrity with foreign keys
- Row-Level Security (RLS) means database access policies are enforced at the database layer — even if someone has the API key, the DB blocks unauthorized reads/writes
- Supabase Storage handles large file uploads with resumable uploads and CDN delivery

### Database Schema (6 tables)

```
profiles         — user roles (admin, reviewer, viewer) linked to Supabase Auth
files            — uploaded files (GLB, STL, PDF) with storage path and version
annotations      — all annotations for a file; position stored as JSONB
activity_logs    — audit trail: who did what and when
share_tokens     — expiring/revocable links for external review access
snapshots        — saved 3D camera states with screenshot images
snapshot_annotations — links annotations to specific camera snapshots
```

### How Annotations Are Stored
The `annotations.position` column is type `JSONB`. For a PDF balloon it stores:
```json
{
  "type": "callout",
  "page": 1,
  "points": [{"x": 0.42, "y": 0.31}],
  "balloonNo": 3,
  "entityType": "Dimension",
  "drawingReference": "Ø10.5",
  "description": "Bore diameter",
  "remarks": "Check with go/no-go gauge",
  "leaderOffset": {"x": 0.06, "y": -0.08},
  "confidence": 0.95,
  "autoDetected": true,
  "sourceText": "Ø10.5"
}
```
Using JSONB means the schema doesn't need to change every time a new annotation field is added.

---

## 11. File Storage — Supabase Storage

### What it is
Supabase Storage is an **S3-compatible object store** (similar to AWS S3 or Google Cloud Storage) integrated directly with Supabase's auth and database.

### What it does in this project
- PDF files, GLB files, and STL files are uploaded here via the `/api/upload` route
- Storage returns a **public URL** (or signed URL for private buckets) — this URL is stored in `files.storage_path` and passed directly to PDF.js or Three.js for rendering
- No file data passes through our Next.js server during rendering — the browser fetches the file directly from Supabase's CDN
- Snapshot screenshots (PNG images of the 3D viewer) are also stored here

---

## 12. Excel Export — SheetJS (xlsx)

### What it is
SheetJS is the most widely used JavaScript library for reading and writing Excel files (`.xlsx`, `.xls`, `.csv`). The community edition (v0.18.5) is free and open-source.

### Important limitation
The **community edition does not support cell styling** (bold, colors, fills). Styling requires SheetJS Pro (paid). This is documented in the code with a comment. The file exports correctly with data, column widths, freeze panes, auto-filter, and merged header — just without color formatting.

### What it does in this project
The API route `/api/export-balloons` (server-side):
1. Builds a 2-sheet workbook: **Balloon Report** (all balloons sorted by number) + **Summary** (count by entity type)
2. The Balloon Report sheet includes: Balloon No., Drawing Reference, Entity Type, Description, Page No., Remarks
3. Column widths are set manually for optimal readability in Excel
4. The first row is a merged header spanning all 6 columns with the report title and date
5. Auto-filter is enabled on the header row so engineers can filter by entity type
6. Returns the file as a binary buffer; the browser triggers a file download

---

## 13. Authentication — Supabase Auth

### What it does
Supabase Auth handles the full authentication lifecycle:
- **Email/password signup and login** with automatic email confirmation
- **Password reset** via email link
- **Session management** — JWT tokens stored in browser cookies, auto-refreshed
- **Middleware protection** (`middleware.ts`) — every page request checks the session; unauthenticated users are redirected to `/login`

### The `@supabase/ssr` package
This adapter is specifically designed for Next.js App Router. It handles the edge case of reading/writing cookies server-side in Next.js Server Components and API routes — something the base `@supabase/supabase-js` client doesn't handle correctly in server contexts.

### Role system
The `profiles.role` column stores one of three values:
- `admin` — full access, can manage team, delete files
- `reviewer` — can annotate and comment
- `viewer` — read-only access (useful for external clients or executives)

---

## 14. Secure Share Links

### How it works
1. A user with `reviewer` or `admin` role clicks **Share** on any file
2. The system calls `/api/share` (POST) which generates a cryptographically random UUID token and stores it in `share_tokens` with:
   - The file ID it belongs to
   - Access mode: `read-only` or `comment-only`
   - Optional expiry timestamp
   - Revokable flag
3. The token becomes a URL: `https://yourapp.com/share/[token]`
4. Anyone with that URL (without requiring a login) can view the file per the access mode
5. The token can be **revoked** at any time, immediately breaking all existing links

### Why this matters
In real industrial QA workflows, external suppliers or customers need to review drawings without creating company accounts. This system handles that securely without exposing internal data.

---

## 15. PDF Manipulation — pdf-lib

### What it is
pdf-lib is a pure-JavaScript library for **creating and modifying PDF documents** (not just rendering them — that's PDF.js).

### What it does in this project
The `/api/export-pdf` and `/api/flatten-pdf` routes use pdf-lib to:
- **Flatten annotations into the PDF** — embed all balloon overlays as actual PDF drawing commands (circles, lines, text) burned into the PDF pages
- The resulting PDF is a standalone document with annotations permanently embedded — no annotation data is needed separately
- This allows sending the annotated drawing to stakeholders who only have a PDF reader

---

## 16. Unique IDs — UUID v4

### What UUID v4 is
UUID (Universally Unique Identifier) v4 generates **128-bit random IDs** like `550e8400-e29b-41d4-a716-446655440000`. The probability of two randomly generated UUIDs colliding is astronomically small (1 in 2¹²²).

### What it does in this project
Every annotation, file, share token, and snapshot is identified by a UUID. New annotations are assigned a local UUID immediately (via `uuidv4()`) before being saved to the database. This means the UI can render a new balloon instantly without waiting for a database round-trip — the ID is known before the DB confirms.

---

## 17. State Management Strategy

There is no Redux or Zustand in this project — **React's built-in state is sufficient** for the scale of this application.

| State type | Where it lives |
|---|---|
| Server data (annotations, files) | `src/hooks/useAnnotations.ts` — custom hook wrapping Supabase calls with `useState` + `useEffect` |
| UI ephemeral state (selected balloon, tool, zoom level) | `useState` inside `PdfAnnotator.tsx` |
| Memoized derived data | `useMemo` — e.g., mapping raw DB annotations to `PDFOverlayItem` |
| Stable callbacks | `useCallback` — prevents unnecessary re-renders in complex SVG annotation trees |

### useAnnotations hook (`src/hooks/useAnnotations.ts`)
This custom hook is the single source of truth for all annotation data:
- Fetches annotations from Supabase on mount
- Exposes `createAnnotation`, `updateAnnotation`, `deleteAnnotation`, `refresh`
- Optimistic updates: local state is updated immediately on write for instant UI feedback, then the DB is written asynchronously
- Has an offline fallback mode (`isOfflineMode`) for demo/development use

---

## 18. Balloon Number Integrity — `src/lib/balloonUtils.ts`

Custom utility library, no third-party dependency:

| Function | What it does |
|---|---|
| `nextBalloonNo(items)` | Returns max existing balloon number + 1 — ensures new balloons never duplicate |
| `resequenceBalloons(items)` | Renumbers all balloons 1, 2, 3... in top-to-bottom, left-to-right reading order (matches how an engineer reads a drawing) |
| `validateBalloonNumbers(items)` | Returns a list of duplicate balloon numbers — used to surface data errors in the UI |
| `countDuplicateBalloons(items)` | Returns count of duplicates — used for the red badge warning in the balloon list |
| `isBalloon(item)` | Returns true if an annotation type is a balloon-type (callout/comment/issue) vs. a drawing annotation (freehand/arrow/highlight/dimension) |

After any delete operation, `resequenceBalloons` is called and all changed balloon numbers are batch-updated in DB to maintain sequence integrity.

---

## 19. Directory Structure — Where Everything Lives

```
src/
├── app/                        Next.js pages and API routes
│   ├── page.tsx               Landing page
│   ├── login/                 Login page
│   ├── signup/                Signup page
│   ├── projects/              Project list (all uploaded files)
│   ├── view/[id]/             File viewer (3D or PDF, based on file type)
│   ├── annotate/              Standalone annotation page
│   ├── share/[token]/         Public shared review links
│   └── api/                   Server-side API routes
│       ├── upload/            File upload handler
│       ├── export-balloons/   Excel export for PDF annotations
│       ├── export-pdf/        Annotated PDF download
│       ├── export-report/     3D annotation report
│       ├── flatten-pdf/       Embed annotations into PDF permanently
│       ├── share/             Share token CRUD
│       ├── snapshots/         3D camera snapshot CRUD
│       └── files/[id]/        File versioning
│
├── components/                React UI components
│   ├── PdfAnnotator.tsx       The PDF canvas + all annotation tools (~1250 lines)
│   ├── PDFViewer.tsx          Wrapper: connects PdfAnnotator to Supabase
│   ├── BalloonList.tsx        Right sidebar: list, edit, delete balloons
│   ├── ViewerToolbar.tsx      Top toolbar: tool selector, zoom, export buttons
│   ├── AppNav.tsx             Left navigation sidebar
│   ├── ShareModal.tsx         Share link creator UI
│   ├── ExportModal.tsx        Export options UI
│   ├── TeamManagement.tsx     User role management UI (admin only)
│   ├── ActivitySidebar.tsx    Audit log / activity feed
│   ├── CommentsSidebar.tsx    Comment thread sidebar
│   ├── engine/                3D viewer sub-components
│   │   ├── CadViewer.tsx      Main 3D scene component
│   │   ├── ModelLoader.tsx    GLB/STL file loader
│   │   ├── Annotations.tsx    3D annotation pin renderer
│   │   ├── Measurements.tsx   3D distance measurement tool
│   │   ├── ClippingPlanes.tsx Cross-section clipping tool
│   │   ├── SceneSetup.tsx     Lights and environment
│   │   ├── geometryUtils.ts   3D math utilities
│   │   └── types.ts           3D-specific TypeScript types
│   └── ui/                    Shared UI primitives
│       ├── Dialogs.tsx        Modal and alert dialog components
│       └── Badge.tsx          Status badge component
│
├── hooks/                     Custom React hooks
│   ├── useAnnotations.ts      Annotation CRUD + Supabase sync
│   ├── useComments.ts         Comment thread management
│   ├── useActivityLog.ts      Activity log fetching
│   └── useFileVersion.ts      File version history
│
├── lib/                       Pure utility / service modules
│   ├── supabaseClient.ts      Browser-side Supabase client (with offline fallback)
│   ├── supabaseAdmin.ts       Server-side Supabase client (service role key)
│   ├── autoBalloon.ts         Auto-balloon AI engine
│   ├── balloonUtils.ts        Balloon number integrity utilities
│   ├── projectionUtils.ts     3D→2D screen projection math
│   ├── config.ts              App-wide configuration constants
│   └── mockSupabase.ts        Offline/demo mode mock data
│
└── types/
    └── index.ts               All TypeScript type definitions (PDFOverlayItem, etc.)
```

---

## 20. Security Architecture

| Threat | Mitigation |
|---|---|
| Unauthorized data access | Supabase Row Level Security (RLS) on all tables |
| XSS via annotation text | Input sanitized via HTML entity encoding before DB insert (`sanitizeAnnotationText`) |
| Injection in annotation data | JSONB parameterization via Supabase client — no raw SQL |
| Unauthorized file access | Files served via Supabase Storage signed URLs with expiry |
| Share link abuse | Tokens are revocable, support expiry timestamps, and are validated server-side |
| Admin-only operations | `supabaseAdmin.ts` uses service-role key, only importable in server API routes — never exposed to browser |

---

## 21. Performance Decisions

| Decision | Why |
|---|---|
| Normalized coordinates (0..1) | Annotations are resolution-independent — correct at any zoom or screen size |
| CSS transform for zoom/pan | GPU-accelerated; doesn't cause React re-renders of annotations |
| BVH acceleration for 3D | 100x faster ray-casting on complex models |
| Optimistic UI updates | Annotations appear instantly; DB write happens in background |
| `useMemo` for DB→UI mapping | Prevents recalculating 100 annotations on every keystroke |
| `useCallback` for event handlers | Prevents SVG re-renders when parent state changes |
| React 19's Compiler | `babel-plugin-react-compiler` automatically memoizes components — less manual optimization needed |
| HiDPI canvas rendering | PDF canvas uses `devicePixelRatio` — sharp on Retina/4K displays |

---

## 22. What "Vector PDF" Means (And Why It Matters)

This is important context for the auto-balloon feature:

**Vector PDF:** Created directly from CAD software (AutoCAD, SolidWorks, CATIA, Creo, etc.) by "printing" or "exporting" to PDF. The PDF internally stores each line, arc, and character as a drawing command — e.g., "draw a circle at X=150 Y=200 radius=10" and "render character 'Ø' at X=148 Y=220 in font ArialMT size 8". PDF.js can read these text commands and extract exact text positions.

**Scanned/Raster PDF:** A physical paper drawing photographed or scanned, then saved as PDF. The PDF internally stores just a bitmap image (pixels). There are no text commands — the "Ø10.5" on the drawing is encoded as colored pixels, not as a character. PDF.js `getTextContent()` returns empty — auto-balloon correctly detects this and alerts the user.

**Implication for this project:** Auto-balloon only works on drawings received electronically from CAD software. Scanned legacy drawings require manual balloon placement.

---

## 23. Glossary

| Term | Meaning |
|---|---|
| **Balloon** | The circular numbered annotation standard in engineering drawings (ASME Y14.5). Number inside refers to a row in the inspection table. |
| **Leader Line** | The line connecting the balloon circle to the feature it annotates on the drawing |
| **GD&T** | Geometric Dimensioning & Tolerancing — an international engineering symbol language for specifying part geometry accuracy |
| **BOM** | Bill of Materials — list of all components; balloons link drawing features to BOM rows |
| **JSONB** | JSON Binary — PostgreSQL's binary representation of JSON that supports indexing and querying |
| **JWT** | JSON Web Token — the format used for Supabase authentication sessions |
| **RLS** | Row Level Security — PostgreSQL feature where access policies are enforced inside the database itself |
| **UUID** | Universally Unique Identifier — 128-bit random string used as database primary key |
| **Normalized Coordinates** | Coordinates expressed as fractions of total width/height (0.0 to 1.0) instead of pixels |
| **BVH** | Bounding Volume Hierarchy — spatial acceleration structure for fast 3D ray intersection |
| **GLB** | GL Binary — binary container of the GLTF 3D format; includes geometry, materials, and textures in one file |
| **STL** | Stereolithography file format — triangular mesh only, no materials; legacy CAD export format |
| **Regex** | Regular Expression — pattern matching syntax used in the auto-balloon classification engine |
| **Turbopack** | Next.js's new Rust-based bundler (faster than Webpack for dev builds) |
| **App Router** | Next.js 13+ routing system based on the filesystem under `src/app/` |

---

*Document prepared: Feb 2026 | Codebase: `ayushbaldota01/CAD-INDUSTRY-v1`*
