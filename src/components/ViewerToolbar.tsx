
'use client'

import React from 'react'

export type ToolType = 'select' | 'comment' | 'measure' | 'cloud'

interface ViewerToolbarProps {
    activeTool: ToolType
    onToolChange: (tool: ToolType) => void
    canComment?: boolean // Permission to use annotation tools
}

export default function ViewerToolbar({ activeTool, onToolChange, canComment = true }: ViewerToolbarProps) {
    const tools: { id: ToolType; label: string; icon: string; requiresComment?: boolean }[] = [
        { id: 'select', label: 'Select / Orbit', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122' },
        { id: 'comment', label: 'Comment / Bubble', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', requiresComment: true },
        { id: 'measure', label: 'Dimensioning', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', requiresComment: true },
        { id: 'cloud', label: 'Rev Cloud', icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z', requiresComment: true }
    ]

    return (
        <div className="flex gap-2 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl shadow-black/50 pointer-events-auto">
            {tools.map((tool) => {
                const isDisabled = tool.requiresComment && !canComment

                return (
                    <button
                        key={tool.id}
                        onClick={() => !isDisabled && onToolChange(tool.id)}
                        disabled={isDisabled}
                        className={`
                            p-2.5 rounded-md transition-all relative group
                            ${isDisabled
                                ? 'opacity-40 cursor-not-allowed text-slate-600'
                                : activeTool === tool.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 scale-105'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                        `}
                        title={isDisabled ? 'Requires reviewer or admin role' : tool.label}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d={tool.icon} />
                        </svg>

                        {/* Tooltip */}
                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
                            {isDisabled ? '🔒 Requires reviewer/admin' : tool.label}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
