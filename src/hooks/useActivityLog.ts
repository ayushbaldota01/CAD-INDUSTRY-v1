
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isOfflineMode } from '@/lib/supabaseClient'

export type ActivityLog = {
    id: string
    file_id: string | null
    action: string
    user_id: string | null
    created_at: string
    user_name?: string
}

// Check if we should skip activity logging
const shouldSkipLogging = () => {
    if (typeof window === 'undefined') return true
    if (isOfflineMode) return true
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url.includes('placeholder')) return true
    return false
}

export const useActivityLog = (fileId?: string) => {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const channelRef = useRef<any>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Fetch activity logs - silent fail
    const fetchLogs = useCallback(async () => {
        if (shouldSkipLogging()) {
            setLoading(false)
            return
        }

        // Skip if no valid fileId
        if (!fileId || fileId === 'demo') {
            setLoading(false)
            return
        }

        setLoading(true)

        try {
            const { data, error: fetchError } = await supabase
                .from('activity_logs')
                .select('*')
                .eq('file_id', fileId)
                .order('created_at', { ascending: false })
                .limit(50)

            if (!fetchError && data) {
                setLogs(data)
                setError(null)
            }
        } catch {
            // Silent fail - don't spam console
        } finally {
            setLoading(false)
        }
    }, [fileId])

    // Initial load with cleanup
    useEffect(() => {
        if (shouldSkipLogging() || !fileId || fileId === 'demo') return

        fetchLogs()

        // Only subscribe if we have a valid fileId
        try {
            channelRef.current = supabase
                .channel(`activity_${fileId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_logs',
                    filter: `file_id=eq.${fileId}`
                }, () => {
                    fetchLogs()
                })
                .subscribe()
        } catch {
            // Silent fail
        }

        return () => {
            if (channelRef.current) {
                try {
                    supabase.removeChannel(channelRef.current)
                } catch {
                    // Ignore cleanup errors
                }
                channelRef.current = null
            }
        }
    }, [fileId, fetchLogs])

    // Log an activity - fire and forget, no errors
    const logActivity = useCallback(async (action: string, targetFileId?: string) => {
        if (shouldSkipLogging()) return

        const fid = targetFileId || fileId
        if (!fid || fid === 'demo') return

        // Fire and forget - don't await or throw
        try {
            const { data: { user } } = await supabase.auth.getUser()

            await supabase
                .from('activity_logs')
                .insert({
                    file_id: fid,
                    action,
                    user_id: user?.id || null
                })
        } catch {
            // Silent fail - never throw errors for activity logging
        }
    }, [fileId])

    return { logs, loading, error, logActivity, refresh: fetchLogs }
}
