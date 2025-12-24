
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
                    console.warn('Profile not found, using auth user data:', error.message)
                    // Use auth user data if profile doesn't exist
                    setProfile({
                        id: user.id,
                        email: user.email || null,
                        full_name: user.user_metadata?.full_name || null,
                        role: 'admin', // Default to admin for now
                        created_at: user.created_at || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                } else {
                    setProfile(data)
                }
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

    // Calculate permissions based on role
    const permissions: RolePermissions = {
        canUpload: profile?.role === 'admin',
        canDelete: profile?.role === 'admin',
        canComment: profile?.role === 'admin' || profile?.role === 'reviewer',
        canEdit: profile?.role === 'admin'
    }

    return {
        profile,
        role: profile?.role || 'viewer',
        permissions,
        loading,
        error,
        isAdmin: profile?.role === 'admin',
        isReviewer: profile?.role === 'reviewer',
        isViewer: profile?.role === 'viewer'
    }
}
