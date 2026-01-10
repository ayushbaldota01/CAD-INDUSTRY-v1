'use client'

/**
 * CadViewer - Main Export
 * 
 * This file re-exports the new optimized engine.
 * Maintains backward compatibility with existing imports.
 */

// Re-export from new engine
export { default } from './engine/CadViewer'
export type { CadViewerRef, Annotation } from './engine/CadViewer'
