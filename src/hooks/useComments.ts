import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type Comment = {
    id: string
    annotation_id: string
    author_id: string
    text: string
    created_at: string
    author_email?: string // Optional joined field
}

export const useComments = (annotationId: string | null) => {
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!annotationId) {
            setComments([])
            return
        }

        const fetchComments = async () => {
            setLoading(true)
            // Join with users to get email/name if possible, but basic select for now
            // RLS might restrict reading users table if not handled. 
            // For this demo, we'll just get the comments and maybe strict author_id.
            // Ideally: .select('*, users(email)')
            const { data, error } = await supabase
                .from('comments')
                .select(`
            *,
            author:users ( email )
        `)
                .eq('annotation_id', annotationId)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching comments:', error)
            } else {
                const formatted = data.map((c: any) => ({
                    ...c,
                    author_email: c.author?.email
                }))
                setComments(formatted)
            }
            setLoading(false)
        }

        fetchComments()

        // Realtime Subscription
        const channel = supabase
            .channel(`comments:${annotationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'comments',
                    filter: `annotation_id=eq.${annotationId}`
                },
                async (payload) => {
                    // We need to fetch the user email for the new comment usually, 
                    // or just optimistic update with "Me" if it's us, or fetch single.
                    // For simplicity, let's just refetch or push plain.
                    // Simple push:
                    // setComments(prev => [...prev, payload.new as Comment])
                    // Better: fetch the single formatted item or just refetch all.

                    // Quick fetch of the new owner details
                    const { data } = await supabase.from('users').select('email').eq('id', payload.new.author_id).single()

                    const newComment = {
                        ...payload.new,
                        author_email: data?.email
                    } as Comment

                    setComments((prev) => [...prev, newComment])
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [annotationId])

    const addComment = async (text: string) => {
        if (!annotationId) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            alert('Please login')
            return
        }

        const { error } = await supabase.from('comments').insert({
            annotation_id: annotationId,
            author_id: user.id,
            text
        })

        if (error) {
            throw error
        }
    }

    return { comments, loading, addComment }
}
