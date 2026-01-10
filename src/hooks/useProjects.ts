/**
 * useProjects Hook - Optimized
 * 
 * Handles project CRUD operations with proper error handling
 * and graceful degradation when offline.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase, isOfflineMode } from '@/lib/supabaseClient'

export type Project = {
    id: string
    name: string
    description: string | null
    created_by: string
    created_at: string
    updated_at: string
    member_count?: number
    file_count?: number
    role?: string
}

type UseProjectsReturn = {
    projects: Project[]
    loading: boolean
    error: string | null
    isOffline: boolean
    createProject: (name: string, description?: string) => Promise<Project | null>
    updateProject: (id: string, updates: { name?: string; description?: string }) => Promise<void>
    deleteProject: (id: string) => Promise<void>
    refresh: () => Promise<void>
}

export function useProjects(): UseProjectsReturn {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            // Get current user
            const { data: { user } } = await supabase.auth.getUser()
            const userId = user?.id

            if (!userId) {
                // Not logged in - show empty state
                setProjects([])
                return
            }

            // Get projects where user is a member
            const { data: memberData, error: memberError } = await supabase
                .from('project_members')
                .select('project_id, role')
                .eq('user_id', userId)

            if (memberError) {
                console.warn('Error fetching member data:', memberError)
                setProjects([])
                return
            }

            const projectIds = (memberData || []).map(m => m.project_id)

            if (projectIds.length === 0) {
                setProjects([])
                return
            }

            // Get project details
            const { data: projectsData, error: projectsError } = await supabase
                .from('projects')
                .select('*')
                .in('id', projectIds)
                .order('updated_at', { ascending: false })

            if (projectsError) {
                console.warn('Error fetching projects:', projectsError)
                setProjects([])
                return
            }

            // Attach role to each project
            const projectsWithRole = (projectsData || []).map(project => ({
                ...project,
                role: memberData?.find(m => m.project_id === project.id)?.role
            }))

            setProjects(projectsWithRole)
        } catch (err: any) {
            console.error('Error in fetchProjects:', err)
            setError(err.message || 'Failed to load projects')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProjects()
    }, [fetchProjects])

    const createProject = useCallback(async (name: string, description?: string): Promise<Project | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const userId = user?.id

            if (!userId) {
                throw new Error('Must be logged in to create projects')
            }

            // Create project
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    name,
                    description: description || null,
                    created_by: userId
                })
                .select()
                .single()

            if (error) throw error
            if (!data) throw new Error('Failed to create project')

            // Add user as owner
            await supabase.from('project_members').insert({
                project_id: data.id,
                user_id: userId,
                role: 'owner'
            })

            // Refresh list
            await fetchProjects()

            return data
        } catch (err: any) {
            console.error('Error creating project:', err)
            throw err
        }
    }, [fetchProjects])

    const updateProject = useCallback(async (id: string, updates: { name?: string; description?: string }) => {
        try {
            const { error } = await supabase
                .from('projects')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error

            await fetchProjects()
        } catch (err: any) {
            console.error('Error updating project:', err)
            throw err
        }
    }, [fetchProjects])

    const deleteProject = useCallback(async (id: string) => {
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)

            if (error) throw error

            await fetchProjects()
        } catch (err: any) {
            console.error('Error deleting project:', err)
            throw err
        }
    }, [fetchProjects])

    return {
        projects,
        loading,
        error,
        isOffline: isOfflineMode,
        createProject,
        updateProject,
        deleteProject,
        refresh: fetchProjects,
    }
}
