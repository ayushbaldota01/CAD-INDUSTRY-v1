
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type ActivityLog = {
    id: string
    file_id: string | null
    action: string
    user_id: string | null
    created_at: string
    user_name?: string // Joined from auth.users if available
}

// Helper to check for demo mode
const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export const useActivityLog = (fileId?: string) => {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch activity logs
    const fetchLogs = useCallback(async () => {
        if (isDemoMode()) {
            setLoading(false)
            return
        }

        setLoading(true)
        let query = supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })

        if (fileId && fileId !== 'demo') {
            query = query.eq('file_id', fileId)
        }

        const { data, error } = await query.limit(100)

        if (error) {
            console.error('Error fetching activity logs:', error)
            setError(error.message)
        } else {
            setLogs(data || [])
        }
        setLoading(false)
    }, [fileId])

    // Initial load
    useEffect(() => {
        fetchLogs()

        if (isDemoMode()) return

        // Subscribe to realtime changes
        const channel = supabase
            .channel(`activity_logs${fileId ? `:${fileId}` : ''}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'activity_logs',
                ...(fileId && fileId !== 'demo' ? { filter: `file_id=eq.${fileId}` } : {})
            }, () => {
                fetchLogs()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fileId, fetchLogs])

    // Log an activity
    const logActivity = async (action: string, targetFileId?: string) => {
        if (isDemoMode()) {
            console.log('[Demo] Activity logged:', action)
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()

            const payload = {
                file_id: targetFileId || fileId || null,
                action,
                user_id: user?.id || null
            }

            const { error } = await supabase
                .from('activity_logs')
                .insert(payload)

            if (error) {
                console.error('Error logging activity:', error)
                throw error
            }

            // Refresh logs
            fetchLogs()
        } catch (e) {
            console.error('Failed to log activity:', e)
        }
    }

    return { logs, loading, error, logActivity, refresh: fetchLogs }
}
