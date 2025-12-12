
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Annotation } from '@/components/CadViewer'
import { demoStore } from '@/lib/demoStore'

// Helper to check for demo mode
const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export const useAnnotations = (modelId: string) => {
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch annotations
    const fetchAnnotations = useCallback(async () => {
        if (!modelId) return

        if (isDemoMode()) {
            setLoading(false)
            // If it's a demo mode file from demoStore, maybe we can fetch from there?
            // For now, let's just return empty or what's in memory.
            // Ideally demoStore should support annotations, but for now simple empty array prevents crashes.
            return
        }

        setLoading(true)
        const { data, error } = await supabase
            .from('annotations')
            .select('*')
            .eq('model_id', modelId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching annotations:', error)
            // Don't set error state to avoid UI breakage, just log it
            // setError(error.message) 
        } else {
            // Map DB annotations (JSON position) to Viewer annotations (Array position)
            const mapped = data.map((d: any) => ({
                id: d.id,
                text: d.text,
                // Handle position stored as JSON {x,y,z} or fallback
                position: d.position && typeof d.position === 'object'
                    ? [d.position.x, d.position.y, d.position.z] as [number, number, number]
                    : [0, 0, 0] as [number, number, number],
                normal: [0, 1, 0] as [number, number, number] // Normal might not be stored, or we can add it to DB schema later. For now default up.
            }))
            setAnnotations(mapped)
        }
        setLoading(false)
    }, [modelId])

    // Initial load
    useEffect(() => {
        fetchAnnotations()

        if (isDemoMode()) return // Skip subscription in demo mode

        // Optional: Realtime subscription could go here
        const channel = supabase
            .channel(`annotations:${modelId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'annotations', filter: `model_id=eq.${modelId}` }, () => {
                fetchAnnotations()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [modelId, fetchAnnotations])

    // Create annotation
    const createAnnotation = async (
        data: { position: [number, number, number]; normal: [number, number, number] },
        text: string
    ) => {
        if (isDemoMode()) {
            // Mock creation
            const newAnn: Annotation = {
                id: 'demo-ann-' + Date.now(),
                text: text,
                position: data.position,
                normal: data.normal
            }
            setAnnotations(prev => [...prev, newAnn])
            return
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            alert('You must be logged in to annotate.')
            return
        }

        const payload = {
            model_id: modelId,
            author_id: user.id,
            text: text,
            type: 'point',
            position: { x: data.position[0], y: data.position[1], z: data.position[2] }, // Store as JSON
            // We could store normal too if we added a column
        }

        const { error } = await supabase
            .from('annotations')
            .insert(payload)

        if (error) {
            console.error('Error creating annotation:', error)
            alert('Failed to save annotation')
            throw error
        }

        // Optimistic update or wait for fetchSubscription
        // We rely on subscription mostly, or we can refetch manually
        // fetchAnnotations() 
    }

    return { annotations, loading, error, createAnnotation, refresh: fetchAnnotations }
}
