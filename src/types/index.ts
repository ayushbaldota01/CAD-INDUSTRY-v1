/**
 * Application Types — Single Source of Truth
 *
 * All shared types live here. Import from '@/types' everywhere.
 * Nothing duplicated, nothing scattered.
 */

// ─── Auth & Users ────────────────────────────────────────────────────────────

export type UserProfile = {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    role: 'admin' | 'reviewer' | 'viewer'
    created_at: string
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export type Project = {
    id: string
    name: string
    description: string | null
    created_by: string
    created_at: string
    updated_at: string
    // Joined fields
    role?: 'owner' | 'admin' | 'reviewer' | 'viewer'
    member_count?: number
    file_count?: number
}

export type ProjectMember = {
    id: string
    project_id: string
    user_id: string
    role: 'owner' | 'admin' | 'reviewer' | 'viewer'
    created_at: string
    // Joined
    user?: UserProfile
}

// ─── Files ────────────────────────────────────────────────────────────────────

export type FileType = '3D' | 'PDF'

export type FileRecord = {
    id: string
    name: string
    type: string          // 'glb' | 'stl' | 'pdf' (matches DB column 'type')
    storage_path: string
    project_id: string | null
    created_by: string
    created_at: string
    updated_at?: string
    version?: number
}

export function getFileDisplayType(file: Pick<FileRecord, 'type' | 'name'>): FileType {
    const ext = file.name?.split('.').pop()?.toLowerCase() || ''
    const mime = file.type?.toLowerCase() || ''
    if (ext === 'pdf' || mime.includes('pdf')) return 'PDF'
    return '3D'
}

// ─── 3D Engine ────────────────────────────────────────────────────────────────

export type ToolType = 'select' | 'measure' | 'comment' | 'cloud' | 'pan' | 'zoom'

export type UnitType = 'mm' | 'cm' | 'in' | 'ft'

export type Annotation3D = {
    id: string
    position: [number, number, number]
    normal: [number, number, number]
    text: string
    type?: 'note' | 'cloud' | 'comment' | 'bubble' | 'dimension'
    status?: 'open' | 'resolved'
    createdAt?: string
    createdBy?: string
}

export type Measurement = {
    id: string
    start: [number, number, number]
    end: [number, number, number]
    distance: number
    label?: string
}

export type SnapResult = {
    point: [number, number, number]
    normal: [number, number, number]
    type: 'vertex' | 'face' | 'edge' | 'center' | 'quadrant' | null
    snapped: boolean
}

export type CameraState = {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
}

export type ViewerRef = {
    exportCamera: () => CameraState
    takeSnapshot: () => string
    resetView: () => void
    fitToModel: () => void
}

// ─── PDF Annotations ─────────────────────────────────────────────────────────

export type PDFOverlayType =
    | 'callout'
    | 'text'
    | 'arrow'
    | 'freehand'
    | 'dimension'
    | 'highlight'
    | 'comment'
    | 'issue'

export type PDFOverlayEntityType =
    | 'Dimension'
    | 'Tolerance'
    | 'GD&T'
    | 'Surface Finish'
    | 'Note'
    | 'Specification'
    | 'Thread'
    | 'Weld'
    | 'Material'

export type PDFOverlayItem = {
    id: string
    type: PDFOverlayType
    points: { x: number; y: number }[]   // Normalized 0..1
    x?: number                             // Primary anchor X (normalized 0..1)
    y?: number                             // Primary anchor Y (normalized 0..1)
    page?: number
    text?: string
    color?: string
    distance?: number                     // Real-world distance for dimension
    unit?: string
    // Balloon metadata
    balloonNo?: number
    entityType?: PDFOverlayEntityType
    drawingReference?: string
    description?: string
    remarks?: string
    // Auto-detection metadata
    confidence?: number                   // 0–1, from auto-detection
    autoDetected?: boolean                // true = from auto-balloon, false = manual
    sourceText?: string                   // raw text from PDF.js before classification
    // Leader line offset (normalized, relative to anchor point)
    leaderOffset?: { x: number; y: number }
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export type ActivityAction =
    | 'file_viewed'
    | 'file_shared'
    | 'file_exported'
    | 'annotation_added'
    | 'annotation_resolved'
    | 'snapshot_created'
    | 'member_invited'

export type ActivityEntry = {
    id: string
    file_id: string
    action: ActivityAction
    created_by: string | null
    created_at: string
    // Joined
    user?: UserProfile
}

// ─── UI Shared ────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type BadgeVariant = 'default' | 'indigo' | 'green' | 'red' | 'yellow' | 'purple'
