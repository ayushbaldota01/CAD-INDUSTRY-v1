
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Annotation } from '@/components/CadViewer'

// Helper to check for demo mode
const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export const useAnnotations = (fileId: string) => {
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch annotations
    const fetchAnnotations = useCallback(async () => {
        if (!fileId || fileId === 'demo') return

        if (isDemoMode()) {
            setLoading(false)
            return
        }

        setLoading(true)
        const { data, error } = await supabase
            .from('annotations')
            .select('*')
            .eq('file_id', fileId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching annotations:', error)
            setError(error.message)
        } else {
            // Map DB annotations to Viewer annotations
            const mapped = data.map((d: any) => ({
                id: d.id,
                text: d.text,
                // Handle position stored as JSON {x,y,z}
                position: d.position && typeof d.position === 'object'
                    ? [d.position.x, d.position.y, d.position.z] as [number, number, number]
                    : [0, 0, 0] as [number, number, number],
                normal: [0, 1, 0] as [number, number, number],
                type: (d.type === 'bubble' ? 'note' : 'cloud') as 'note' | 'cloud' // simple mapping
            }))
            setAnnotations(mapped)
        }
        setLoading(false)
    }, [fileId])

    // Initial load
    useEffect(() => {
        fetchAnnotations()

        if (isDemoMode() || !fileId) return

        const channel = supabase
            .channel(`annotations:${fileId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'annotations', filter: `file_id=eq.${fileId}` }, () => {
                fetchAnnotations()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fileId, fetchAnnotations])

    // Create annotation
    const createAnnotation = async (
        data: { position: any; normal: [number, number, number] }, // Allow any for PDF support
        text: string
    ) => {
        if (isDemoMode() || fileId === 'demo') {
            const newAnn: Annotation = {
                id: 'demo-ann-' + Date.now(),
                text: text,
                position: Array.isArray(data.position) ? (data.position as [number, number, number]) : [0, 0, 0],
                normal: data.normal,
                type: 'note'
            }
            setAnnotations(prev => [...prev, newAnn])
            return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            alert('You must be logged in to annotate.')
            throw new Error('User not logged in')
        }

        // Logic to determine payload based on position structure
        let posPayload = data.position;
        if (Array.isArray(data.position)) {
            // 3D format: [x,y,z] -> {x,y,z}
            posPayload = { x: data.position[0], y: data.position[1], z: data.position[2] }
        }

        const payload = {
            file_id: fileId,
            created_by: user.id,
            text: text,
            type: 'bubble',
            position: posPayload,
            extra: { normal: data.normal }
        }

        const { error } = await supabase
            .from('annotations')
            .insert(payload)

        if (error) {
            console.error('Error creating annotation:', error)
            throw error
        }

        // Log activity
        await supabase
            .from('activity_logs')
            .insert({
                file_id: fileId,
                action: 'annotation_added',
                user_id: user.id
            })

        fetchAnnotations()
    }

    // Optimistic update (for UI responsiveness)
    const updateAnnotation = (id: string, updates: any) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    }

    return { annotations, loading, error, createAnnotation, updateAnnotation, refresh: fetchAnnotations }
}
