/**
 * Engine Module Exports
 * 
 * Clean barrel export for all engine components.
 */

// Main viewer
export { default as CadViewer } from './CadViewer'
export type { CadViewerRef } from './CadViewer'

// Types
export type {
    Annotation,
    Measurement,
    ToolType,
    ViewerRef,
    ViewerProps,
    SnapResult,
    CameraState,
    LoadingState,
} from './types'

export { getFileType, FILE_EXTENSIONS } from './types'

// Components (for advanced usage)
export { ModelLoader } from './ModelLoader'
export { SceneSetup, Lighting, GroundGrid } from './SceneSetup'
export { AnnotationsLayer, AnnotationMarker, AnnotationInput } from './Annotations'
export { MeasurementsLayer, MeasurementLine, TempMeasurementPoint, SnapIndicator } from './Measurements'

// Utilities
export {
    findNearestVertex,
    processIntersection,
    calculateDistance,
    getMidpoint,
    createId
} from './utils'
