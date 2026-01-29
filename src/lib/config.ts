/**
 * Application Configuration - Production Optimized
 * 
 * Centralized configuration for the CAD Viewer application.
 * This provides a single source of truth for all settings.
 * 
 * SECURITY: No secrets here - all values are safe for client-side
 */

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

export const IS_BROWSER = typeof window !== 'undefined'
export const IS_DEV = process.env.NODE_ENV === 'development'
export const IS_PROD = process.env.NODE_ENV === 'production'

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Validate Supabase configuration
 * 
 * Returns false if credentials are missing, placeholder values,
 * or don't match expected format
 */
export const isSupabaseConfigured = (): boolean => {
    if (!supabaseUrl || !supabaseKey) return false
    if (supabaseUrl.includes('placeholder')) return false
    if (supabaseKey === 'placeholder') return false
    if (!supabaseUrl.startsWith('https://')) return false
    if (!supabaseUrl.includes('.supabase.')) return false
    return true
}

export const SUPABASE_CONFIG = {
    url: supabaseUrl,
    anonKey: supabaseKey,
    isConfigured: isSupabaseConfigured(),
} as const

// ============================================================================
// 3D ENGINE CONFIGURATION
// ============================================================================

export const ENGINE_CONFIG = {
    // Performance settings
    maxVerticesForSnap: 5000,      // Limit vertex checking for snapping
    snapTolerance: 0.1,            // Snapping distance threshold in world units

    // Rendering quality
    pixelRatio: [1, 1.5] as [number, number],  // Device pixel ratio [min, max]
    antialias: true,
    shadowMapEnabled: false,       // Disabled for better performance

    // Camera defaults - industry standard CAD view
    camera: {
        fov: 50,                   // Field of view in degrees
        near: 0.01,                // Near clipping plane (closer for detailed work)
        far: 2000,                 // Far clipping plane
        position: [4, 4, 4] as [number, number, number],
    },

    // Units configuration
    units: {
        default: 'mm',
        options: ['mm', 'cm', 'in', 'ft'] as const,
    },

    // Clipping planes settings
    clipping: {
        enabled: true,
        color: '#3b82f6',
        opacity: 0.2,
    },

    // Orbit controls
    controls: {
        enableDamping: true,
        dampingFactor: 0.08,
        rotateSpeed: 0.8,
        zoomSpeed: 1.0,
        panSpeed: 0.8,
        minDistance: 0.1,          // Allow close zoom for details
        maxDistance: 200,          // Reasonable max distance
        maxPolarAngle: Math.PI,    // Allow full vertical rotation
    },

    // Draco decoder for compressed GLB files
    // Using Google's CDN for reliability
    dracoUrl: 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/',

    // Frame budget for animations (ms)
    frameBudget: 16, // Target 60fps

    // Frame budget for heavy snap operations (ms)
    // Used to limit CPU time on click events
    snapBudget: 8, // Half frame budget for responsiveness

    // Circle detection cache settings
    circleCacheSize: 100, // Max cached circle detection results
} as const

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
    timeout: 10000,                // 10 second timeout
    retryAttempts: 3,
    retryDelay: 1000,              // 1 second between retries
    maxUploadSize: 500 * 1024 * 1024, // 500MB
    maxSnapshotSize: 10 * 1024 * 1024, // 10MB for snapshots
} as const

// ============================================================================
// FILE FORMAT CONFIGURATION
// ============================================================================

export const SUPPORTED_3D_FORMATS = ['glb', 'gltf', 'stl', 'obj'] as const
export const SUPPORTED_DOC_FORMATS = ['pdf'] as const
export const PARAMETRIC_FORMATS = [
    'step', 'stp',      // STEP files
    'sldprt', 'sldasm', // SolidWorks
    'asm', 'prt',       // Creo/ProE
    'ipt', 'iam',       // Inventor
    'catpart',          // CATIA
    'x_t', 'x_b',       // Parasolid
    'iges', 'igs'       // IGES
] as const

export type Supported3DFormat = typeof SUPPORTED_3D_FORMATS[number]
export type SupportedDocFormat = typeof SUPPORTED_DOC_FORMATS[number]
export type ParametricFormat = typeof PARAMETRIC_FORMATS[number]

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const COLORS = {
    // UI Colors
    primary: '#6366f1',       // Indigo
    success: '#10b981',       // Emerald
    warning: '#f59e0b',       // Amber
    error: '#ef4444',         // Red
    info: '#3b82f6',          // Blue

    // Annotation markers
    annotation: {
        note: '#6366f1',      // Indigo
        cloud: '#ef4444',     // Red
        resolved: '#10b981',  // Green
    },

    // Measurement visuals
    measurement: '#facc15',   // Yellow

    // CAD standard colors
    cad: {
        grid: '#334155',
        gridBold: '#64748b',
        model: '#b0b0b0',
        highlight: '#3b82f6',
        selection: '#6366f1',
    },
} as const

// ============================================================================
// FALLBACK / DEMO MODELS
// ============================================================================

// Light fallback model for demo - simple box (small file size)
export const FALLBACK_MODEL_URL =
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Box/glTF-Binary/Box.glb'

// Alternative fallback models (kept for reference)
export const DEMO_MODELS = {
    box: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Box/glTF-Binary/Box.glb',
    suzanne: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Suzanne/glTF-Binary/Suzanne.glb',
} as const

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURES = {
    // Enable/disable features globally
    annotations: true,
    measurements: true,
    snapshots: true,
    sharing: true,
    versioning: true,

    // Development features
    performanceMonitor: IS_DEV,
    debugLogs: IS_DEV,
} as const

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EngineConfig = typeof ENGINE_CONFIG
export type ApiConfig = typeof API_CONFIG
export type Colors = typeof COLORS
