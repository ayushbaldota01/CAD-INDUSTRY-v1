
'use client'

import React from 'react'
import { useActivityLog } from '@/hooks/useActivityLog'

interface ActivitySidebarProps {
    fileId?: string
    onClose: () => void
}

export default function ActivitySidebar({ fileId, onClose }: ActivitySidebarProps) {
    const { logs, loading } = useActivityLog(fileId)

    const formatAction = (action: string) => {
        // Make actions more readable
        const actionMap: Record<string, { icon: string; label: string; color: string }> = {
            'file_uploaded': { icon: '📤', label: 'File Uploaded', color: 'text-green-400' },
            'version_created': { icon: '🔄', label: 'New Version Created', color: 'text-blue-400' },
            'annotation_added': { icon: '💬', label: 'Annotation Added', color: 'text-purple-400' },
            'annotation_edited': { icon: '✏️', label: 'Annotation Edited', color: 'text-yellow-400' },
            'annotation_deleted': { icon: '🗑️', label: 'Annotation Deleted', color: 'text-red-400' },
        }

        return actionMap[action] || { icon: '📝', label: action, color: 'text-slate-400' }
    }

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    return (
        <div className="absolute top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-30 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
                <div>
                    <h3 className="font-semibold text-white text-lg">Activity Log</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {fileId ? 'File activity' : 'All activity'}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white transition p-2 hover:bg-slate-800 rounded"
                >
                    ✕
                </button>
            </div>

            {/* Activity List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="text-slate-500 text-sm">Loading activity...</div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                        <div className="text-4xl mb-2">📋</div>
                        <div className="text-slate-500 text-sm">No activity yet</div>
                        <div className="text-slate-600 text-xs mt-1">
                            Actions will appear here
                        </div>
                    </div>
                ) : (
                    logs.map((log) => {
                        const actionInfo = formatAction(log.action)
                        return (
                            <div
                                key={log.id}
                                className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600 transition"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl flex-shrink-0">{actionInfo.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-medium text-sm ${actionInfo.color}`}>
                                            {actionInfo.label}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {log.user_id ? (
                                                <span>by User {log.user_id.slice(0, 8)}...</span>
                                            ) : (
                                                <span>by Unknown User</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {formatTimestamp(log.created_at)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/50">
                <div className="text-xs text-slate-500 text-center">
                    Showing {logs.length} {logs.length === 1 ? 'activity' : 'activities'}
                </div>
            </div>
        </div>
    )
}
