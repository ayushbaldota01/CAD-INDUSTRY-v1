/**
 * useAnnotations Hook - Optimized
 * 
 * Handles annotation CRUD operations with graceful offline fallback.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase, isOfflineMode } from '@/lib/supabaseClient'
import type { Annotation } from '@/components/engine/types'

// ============================================================================
// SECURITY: TEXT SANITIZATION
// ============================================================================

const MAX_ANNOTATION_LENGTH = 2000 // Maximum characters per annotation

/**
 * Sanitize annotation text to prevent XSS attacks
 * Encodes HTML entities and limits length
 */
function sanitizeAnnotationText(text: string): string {
    if (!text || typeof text !== 'string') return ''

    return text
        .slice(0, MAX_ANNOTATION_LENGTH)  // Enforce max length
        .replace(/&/g, '&amp;')            // Must be first
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .trim()
}
/**
 * Validate annotation data structure
 * Supports:
 * - 2D point object: { x: 0.5, y: 0.5 }
 * - 3D array: [x, y, z]
 * - PDF metadata object: { page, type, points, color, ... }
 */
function isValidPosition(pos: any): boolean {
    if (!pos || typeof pos !== 'object') return false

    // Support PDF metadata format: { page, points, type, ... }
    if (pos.points && Array.isArray(pos.points)) {
        return pos.points.length > 0 &&
            typeof pos.points[0] === 'object' &&
            typeof pos.points[0].x === 'number'
    }

    // Support 2D object format: { x: 0.5, y: 0.5 } (from PDF annotator)
    if (!Array.isArray(pos) && typeof pos.x === 'number' && typeof pos.y === 'number') {
        return isFinite(pos.x) && isFinite(pos.y)
    }

    // Support 3D array format: [x, y, z] (from 3D CAD viewer)
    if (Array.isArray(pos) && pos.length >= 2) {
        return pos.slice(0, 3).every((n: any) => typeof n === 'number' && isFinite(n))
    }

    return false
}

/**
 * Normalize position for DB storage
 * - For 3D coords: returns [x, y, z] array
 * - For PDF metadata: returns the full object as-is (DB stores as JSONB)
 */
function normalizePosition(pos: any): any {
    // PDF metadata format - keep as-is for JSONB storage
    if (pos && typeof pos === 'object' && !Array.isArray(pos) && pos.points) {
        return pos
    }

    // Simple 2D object format: { x, y } -> convert to array
    if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
        return [pos.x ?? 0, pos.y ?? 0, pos.z ?? 0]
    }

    // Array format: [x, y] or [x, y, z]
    if (Array.isArray(pos) && pos.length >= 2) {
        return [pos[0], pos[1], pos[2] ?? 0]
    }

    return [0, 0, 0]
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

type UseAnnotationsReturn = {
    annotations: Annotation[]
    loading: boolean
    error: string | null
    createAnnotation: (
        data: { position: any; normal: any },
        text: string
    ) => Promise<Annotation | null>
    updateAnnotation: (id: string, updates: Partial<Annotation>) => Promise<void>
    deleteAnnotation: (id: string) => Promise<void>
    refresh: () => Promise<void>
}

export function useAnnotations(fileId: string): UseAnnotationsReturn {
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAnnotations = useCallback(async () => {
        if (!fileId) {
            setAnnotations([])
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('annotations')
                .select('*')
                .eq('file_id', fileId)
                .order('created_at', { ascending: true })

            if (fetchError) {
                console.warn('Error fetching annotations:', fetchError)
                setAnnotations([])
                return
            }

            // Transform database format to component format
            // Note: normal and status are stored in the 'extra' JSONB column
            const transformed: Annotation[] = (data || []).map((ann: any) => {
                const extra = ann.extra || {}
                return {
                    id: ann.id,
                    position: ann.position || [0, 0, 0],
                    normal: extra.normal || [0, 1, 0],
                    text: ann.text || '',
                    type: ann.type || 'comment',
                    status: extra.status || 'open',
                    createdAt: ann.created_at,
                    createdBy: ann.created_by,
                }
            })

            setAnnotations(transformed)
        } catch (err: any) {
            console.error('Error in fetchAnnotations:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [fileId])

    useEffect(() => {
        fetchAnnotations()
    }, [fetchAnnotations])

    const createAnnotation = useCallback(async (
        data: { position: any; normal: any },
        text: string
    ): Promise<Annotation | null> => {
        // ========== SECURITY: Validate and sanitize input ==========
        if (!isValidPosition(data.position)) {
            console.error('useAnnotations: Invalid position data')
            return null
        }

        // Text is optional for drawing annotations (freehand, highlight, arrow)
        // Only sanitize if text was provided
        const sanitizedText = text ? sanitizeAnnotationText(text) : ''
        // =============================================================

        try {
            const { data: { user } } = await supabase.auth.getUser()

            // Normalize position to 3D array format for DB storage
            const normalizedPosition = normalizePosition(data.position)

            // Store normal and status in the 'extra' JSONB column since
            // the database schema doesn't have dedicated columns for them
            const newAnnotation = {
                file_id: fileId,
                position: normalizedPosition,
                extra: {
                    normal: data.normal,
                    status: 'open'
                },
                text: sanitizedText, // Use sanitized text
                type: 'comment', // Use valid enum value: 'comment', 'bubble', 'dimension'
                created_by: user?.id || null,
            }

            const { data: result, error } = await supabase
                .from('annotations')
                .insert(newAnnotation)
                .select()
                .single()

            if (error) throw error

            // Transform and add to local state
            // Read normal and status from extra JSONB
            const extra = result.extra || {}
            const transformed: Annotation = {
                id: result.id,
                position: result.position,
                normal: extra.normal || data.normal,
                text: result.text,
                type: result.type,
                status: extra.status || 'open',
                createdAt: result.created_at,
                createdBy: result.created_by,
            }

            setAnnotations(prev => [...prev, transformed])

            return transformed
        } catch (err: any) {
            console.error('Error creating annotation:', err)

            // Offline fallback - create local-only annotation
            if (isOfflineMode) {
                const localAnnotation: Annotation = {
                    id: `local-${Date.now()}`,
                    position: data.position,
                    normal: data.normal,
                    text,
                    type: 'note',
                    status: 'open',
                }
                setAnnotations(prev => [...prev, localAnnotation])
                return localAnnotation
            }

            throw err
        }
    }, [fileId])

    const updateAnnotation = useCallback(async (id: string, updates: Partial<Annotation>) => {
        try {
            // Update local state immediately for responsiveness
            setAnnotations(prev =>
                prev.map(ann => ann.id === id ? { ...ann, ...updates } : ann)
            )

            // Skip API call for local-only annotations
            if (id.startsWith('local-')) return

            // Filter to only valid database columns
            // The DB schema has: id, file_id, position, text, type, extra, created_by, created_at
            // Frontend adds: normal, status (which go into extra JSONB)
            const dbUpdates: Record<string, any> = {}

            if (updates.text !== undefined) dbUpdates.text = updates.text
            if (updates.position !== undefined) dbUpdates.position = updates.position
            if (updates.type !== undefined) dbUpdates.type = updates.type

            // Handle extra field updates (normal, status)
            if (updates.normal !== undefined || updates.status !== undefined) {
                // Fetch current extra to merge
                const { data: current } = await supabase
                    .from('annotations')
                    .select('extra')
                    .eq('id', id)
                    .single()

                dbUpdates.extra = {
                    ...(current?.extra || {}),
                    ...(updates.normal !== undefined ? { normal: updates.normal } : {}),
                    ...(updates.status !== undefined ? { status: updates.status } : {})
                }
            }

            // Only make API call if we have valid updates
            if (Object.keys(dbUpdates).length === 0) return

            const { error } = await supabase
                .from('annotations')
                .update(dbUpdates)
                .eq('id', id)

            if (error) throw error
        } catch (err: any) {
            // Only log unexpected errors (not 404s for missing annotations)
            if (!err.message?.includes('No rows')) {
                console.error('Error updating annotation:', err)
            }
            // Don't throw - local state is already updated
        }
    }, [])

    const deleteAnnotation = useCallback(async (id: string) => {
        try {
            // Update local state immediately
            setAnnotations(prev => prev.filter(ann => ann.id !== id))

            // Skip API call for local-only annotations
            if (id.startsWith('local-')) return

            const { error } = await supabase
                .from('annotations')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (err: any) {
            console.error('Error deleting annotation:', err)
        }
    }, [])

    return {
        annotations,
        loading,
        error,
        createAnnotation,
        updateAnnotation,
        deleteAnnotation,
        refresh: fetchAnnotations,
    }
}
