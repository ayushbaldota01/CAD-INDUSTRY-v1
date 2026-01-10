/**
 * 3D Engine Types
 * 
 * Clean type definitions for the CAD viewer engine.
 * Separated for reusability and clarity.
 */

// Annotation on 3D model
export type Annotation = {
    id: string
    position: [number, number, number]
    normal: [number, number, number]
    text: string
    type?: 'note' | 'cloud' | 'comment' | 'bubble' | 'dimension'
    status?: 'open' | 'resolved'
    createdAt?: string
    createdBy?: string
}

// Distance measurement between two points
export type Measurement = {
    id: string
    start: [number, number, number]
    end: [number, number, number]
    distance: number
    label?: string
}

// Available viewer tools
export type ToolType = 'select' | 'measure' | 'comment' | 'cloud' | 'pan' | 'zoom'

// Snap point result from raycasting
export type SnapResult = {
    point: [number, number, number]
    normal: [number, number, number]
    type: 'vertex' | 'face' | 'edge' | 'center' | 'quadrant' | null
    snapped: boolean
}

// Camera state for exports/snapshots
export type CameraState = {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
}

// Viewer ref for external control
export type ViewerRef = {
    exportCamera: () => CameraState
    takeSnapshot: () => string
    resetView: () => void
    fitToModel: () => void
}

// Props for the main viewer component
export type ViewerProps = {
    modelUrl: string
    modelName?: string
    annotations: Annotation[]
    activeTool: ToolType
    onAnnotate?: (data: { position: [number, number, number]; normal: [number, number, number] }, text: string) => void
    onAnnotationSelect?: (annotation: Annotation) => void
    onAnnotationUpdate?: (id: string, updates: Partial<Annotation>) => void
    onLoad?: () => void
    onError?: (error: Error) => void
}

// Model loading states
export type LoadingState = 'idle' | 'loading' | 'ready' | 'error'

// Supported file extensions
export const FILE_EXTENSIONS = {
    GLTF: ['gltf', 'glb'],
    STL: ['stl'],
    OBJ: ['obj'],
    PARAMETRIC: ['step', 'stp', 'sldprt', 'sldasm', 'asm', 'prt', 'ipt', 'iam', 'catpart'],
} as const

// Get file type from extension
export function getFileType(filename: string): 'gltf' | 'stl' | 'obj' | 'parametric' | 'unknown' {
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    if (FILE_EXTENSIONS.GLTF.includes(ext as any)) return 'gltf'
    if (FILE_EXTENSIONS.STL.includes(ext as any)) return 'stl'
    if (FILE_EXTENSIONS.OBJ.includes(ext as any)) return 'obj'
    if (FILE_EXTENSIONS.PARAMETRIC.includes(ext as any)) return 'parametric'

    return 'unknown'
}
