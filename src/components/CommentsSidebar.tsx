'use client'

import React, { useState } from 'react'
import { useComments } from '@/hooks/useComments'
import { Annotation } from '@/components/CadViewer'

type Props = {
    selectedAnnotation: Annotation | null
    onClose: () => void
}

export default function CommentsSidebar({ selectedAnnotation, onClose }: Props) {
    const { comments, loading, addComment } = useComments(selectedAnnotation?.id || null)
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!text.trim()) return
        setSending(true)
        try {
            await addComment(text)
            setText('')
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSending(false)
        }
    }

    if (!selectedAnnotation) {
        return null
    }

    return (
        <div className="absolute top-16 right-0 bottom-0 w-80 bg-slate-900 border-l border-slate-800 shadow-xl flex flex-col z-20">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div>
                    <h3 className="text-white font-medium text-sm">Thread</h3>
                    <p className="text-slate-500 text-xs truncate max-w-[200px]">{selectedAnnotation.text}</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading && <div className="text-center text-slate-500 text-xs">Loading comments...</div>}

                {comments.length === 0 && !loading && (
                    <p className="text-slate-600 text-xs text-center mt-4">No comments yet.</p>
                )}

                {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center text-xs text-indigo-400 font-bold shrink-0">
                            {comment.author_email?.[0].toUpperCase() || '?'}
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold text-slate-300">{comment.author_email?.split('@')[0] || 'Unknown'}</span>
                                <span className="text-[10px] text-slate-600">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/50 p-2 rounded rounded-tl-none">
                                {comment.text}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        placeholder="Reply..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={sending || !text.trim()}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    )
}
