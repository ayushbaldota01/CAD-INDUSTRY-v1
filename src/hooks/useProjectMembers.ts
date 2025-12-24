import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect } from 'react'

export type ProjectMember = {
    user_id: string
    project_id: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    joined_at: string
    profile?: {
        full_name: string
        email: string
    }
}

export function useProjectMembers(projectId: string) {
    const [members, setMembers] = useState<ProjectMember[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchMembers = async () => {
        try {
            setLoading(true)

            // Get project members
            const { data: membersData, error: membersError } = await supabase
                .from('project_members')
                .select('*')
                .eq('project_id', projectId)

            if (membersError) throw membersError

            // Get user profiles for each member
            const userIds = membersData.map(m => m.user_id)
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds)

            if (profilesError) throw profilesError

            // Merge members with profiles
            const membersWithProfiles = membersData.map(member => ({
                ...member,
                profile: profilesData.find(p => p.id === member.user_id)
            }))

            setMembers(membersWithProfiles)
        } catch (err: any) {
            console.error('Error fetching members:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (projectId) {
            fetchMembers()
        }
    }, [projectId])

    const addMember = async (email: string, role: 'admin' | 'member' | 'viewer' = 'member') => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Find user by email
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single()

            if (profileError || !profileData) {
                throw new Error('User not found with that email')
            }

            // Add to project
            const { error: addError } = await supabase
                .from('project_members')
                .insert({
                    project_id: projectId,
                    user_id: profileData.id,
                    role,
                    invited_by: user.id
                })

            if (addError) throw addError

            await fetchMembers()
        } catch (err: any) {
            console.error('Error adding member:', err)
            throw err
        }
    }

    const updateMemberRole = async (userId: string, newRole: 'admin' | 'member' | 'viewer') => {
        try {
            const { error } = await supabase
                .from('project_members')
                .update({ role: newRole })
                .eq('project_id', projectId)
                .eq('user_id', userId)

            if (error) throw error

            await fetchMembers()
        } catch (err: any) {
            console.error('Error updating role:', err)
            throw err
        }
    }

    const removeMember = async (userId: string) => {
        try {
            const { error } = await supabase
                .from('project_members')
                .delete()
                .eq('project_id', projectId)
                .eq('user_id', userId)

            if (error) throw error

            await fetchMembers()
        } catch (err: any) {
            console.error('Error removing member:', err)
            throw err
        }
    }

    return {
        members,
        loading,
        error,
        addMember,
        updateMemberRole,
        removeMember,
        refresh: fetchMembers
    }
}
