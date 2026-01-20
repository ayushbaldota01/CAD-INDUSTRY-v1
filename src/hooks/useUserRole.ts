
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type UserRole = 'admin' | 'reviewer' | 'viewer'

export type UserProfile = {
    id: string
    email: string | null
    full_name: string | null
    role: UserRole
    created_at: string
    updated_at: string
}

export type RolePermissions = {
    canUpload: boolean
    canDelete: boolean
    canComment: boolean
    canEdit: boolean
}

// Helper to check for demo mode
const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export const useUserRole = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchProfile = async () => {
            // Check for demo/placeholder mode
            if (isDemoMode()) {
                // Demo mode: default to admin
                setProfile({
                    id: 'demo-user',
                    email: 'demo@example.com',
                    full_name: 'Demo User',
                    role: 'admin',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                setLoading(false)
                return
            }

            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    setProfile(null)
                    setLoading(false)
                    return
                }

                // Try to get profile from database
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (error) {
                    // Expected when profiles table doesn't exist - handled gracefully below
                    // Only log actual errors, not missing table/rows
                    if (!error.message?.includes('406') && !error.code?.includes('PGRST')) {
                        console.warn('Profile fetch issue:', error.message)
                    }
                }

                // Always grant full permissions in standalone mode
                setProfile({
                    id: user.id,
                    email: user.email || null,
                    full_name: data?.full_name || user.user_metadata?.full_name || null,
                    role: 'admin', // Always admin in standalone mode
                    created_at: user.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            } catch (e: any) {
                console.error('Error in fetchProfile:', e)
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchProfile()
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // All users have full permissions in standalone mode
    const permissions: RolePermissions = {
        canUpload: true,
        canDelete: true,
        canComment: true,
        canEdit: true
    }

    return {
        profile,
        role: 'admin' as UserRole, // Always admin in standalone mode
        permissions,
        loading,
        error,
        isAdmin: true,
        isReviewer: false,
        isViewer: false
    }
}
