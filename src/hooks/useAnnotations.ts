/**
 * useAnnotations Hook - Optimized
 * 
 * Handles annotation CRUD operations with graceful offline fallback.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase, isOfflineMode } from '@/lib/supabaseClient'
import type { Annotation } from '@/components/engine/types'

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
        try {
            const { data: { user } } = await supabase.auth.getUser()

            // Store normal and status in the 'extra' JSONB column since
            // the database schema doesn't have dedicated columns for them
            const newAnnotation = {
                file_id: fileId,
                position: data.position,
                extra: {
                    normal: data.normal,
                    status: 'open'
                },
                text,
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

            const { error } = await supabase
                .from('annotations')
                .update(updates)
                .eq('id', id)

            if (error) throw error
        } catch (err: any) {
            console.error('Error updating annotation:', err)
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
