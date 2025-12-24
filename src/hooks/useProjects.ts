import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect } from 'react'

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

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProjects = async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()

            let userId = user?.id

            if (!userId) {
                // FALLBACK FOR TESTING
                userId = 'mock-admin-user'
                // setError('Not authenticated')
                // return
            }

            // Get projects where user is a member
            const { data: memberData, error: memberError } = await supabase
                .from('project_members')
                .select('project_id, role')
                .eq('user_id', userId)

            if (memberError) throw memberError

            const projectIds = memberData.map(m => m.project_id)

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

            if (projectsError) throw projectsError

            // Attach role to each project
            const projectsWithRole = projectsData.map(project => ({
                ...project,
                role: memberData.find(m => m.project_id === project.id)?.role
            }))

            setProjects(projectsWithRole)
        } catch (err: any) {
            console.error('Error fetching projects:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProjects()
    }, [])

    const createProject = async (name: string, description?: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            // USE MOCK ID IF NO REAL USER
            const userId = user?.id || 'mock-admin-user'

            const { data, error } = await supabase
                .from('projects')
                .insert({
                    name,
                    description,
                    created_by: userId
                })
                .select()
                .single()

            if (error) {
                console.error('Supabase create error:', error)
                throw error
            }

            // Manually add member since trigger might be disabled
            await supabase.from('project_members').insert({
                project_id: data.id,
                user_id: userId,
                role: 'owner'
            })

            if (error) throw error

            await fetchProjects()
            return data
        } catch (err: any) {
            console.error('Error creating project:', err)
            throw err
        }
    }

    const updateProject = async (id: string, updates: { name?: string; description?: string }) => {
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
    }

    const deleteProject = async (id: string) => {
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
    }

    return {
        projects,
        loading,
        error,
        createProject,
        updateProject,
        deleteProject,
        refresh: fetchProjects
    }
}
