'use client'

/**
 * Viewer Toolbar Component
 * 
 * Clean toolbar with tool selection for the CAD viewer.
 */

import React, { memo, useCallback } from 'react'

export type ToolType = 'select' | 'measure' | 'comment' | 'cloud' | 'pan' | 'zoom'

type Tool = {
    id: ToolType
    icon: React.ReactNode
    label: string
    shortcut?: string
}

const TOOLS: Tool[] = [
    {
        id: 'select',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
        ),
        label: 'Select',
        shortcut: 'V',
    },
    {
        id: 'measure',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
        ),
        label: 'Measure',
        shortcut: 'M',
    },
    {
        id: 'comment',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
        label: 'Comment',
        shortcut: 'C',
    },
    {
        id: 'cloud',
        icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
        ),
        label: 'Issue',
        shortcut: 'I',
    },
]

import type { UnitType } from '@/components/engine/types'

type ViewerToolbarProps = {
    activeTool: ToolType
    onToolChange: (tool: ToolType) => void
    canComment?: boolean
    units?: UnitType
    onUnitChange?: (units: UnitType) => void
    showClipping?: boolean
    onClippingChange?: (show: boolean) => void
}

export const ViewerToolbar = memo(function ViewerToolbar({
    activeTool,
    onToolChange,
    canComment = true,
    units = 'mm',
    onUnitChange,
    showClipping = false,
    onClippingChange,
}: ViewerToolbarProps) {
    const handleClick = useCallback((tool: ToolType) => {
        onToolChange(tool)
    }, [onToolChange])

    // Handle keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return
            }

            const key = e.key.toLowerCase()

            switch (key) {
                case 'v':
                    onToolChange('select')
                    break
                case 'm':
                    onToolChange('measure')
                    break
                case 'c':
                    if (canComment) onToolChange('comment')
                    break
                case 'i':
                    if (canComment) onToolChange('cloud')
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onToolChange, canComment])

    return (
        <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-1.5 rounded-lg border border-slate-700 shadow-xl backdrop-blur-md">
            {TOOLS.map((tool) => {
                const isDisabled = (tool.id === 'comment' || tool.id === 'cloud') && !canComment
                const isActive = activeTool === tool.id

                return (
                    <button
                        key={tool.id}
                        onClick={() => handleClick(tool.id)}
                        disabled={isDisabled}
                        className={`
                            relative p-2 rounded-md transition-all duration-150 group
                            ${isActive
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                            }
                            ${isDisabled
                                ? 'opacity-30 cursor-not-allowed'
                                : 'cursor-pointer'
                            }
                        `}
                        title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                    >
                        {tool.icon}

                        {/* Tooltip */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-slate-900 text-white text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap border border-slate-700">
                                {tool.label}
                                {tool.shortcut && (
                                    <span className="ml-1 text-slate-400">({tool.shortcut})</span>
                                )}
                            </div>
                        </div>
                    </button>
                )
            })}

            {/* Divider */}
            <div className="w-px h-6 bg-slate-700 mx-1" />

            {/* Advanced Controls */}
            {onClippingChange && (
                <button
                    onClick={() => onClippingChange(!showClipping)}
                    className={`
                        relative p-2 rounded-md transition-all duration-150 group
                        ${showClipping
                            ? 'bg-indigo-600/50 text-indigo-100 border border-indigo-500/50'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }
                    `}
                    title="Toggle Section Cut"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>

                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-slate-900 text-white text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap border border-slate-700">
                            Section Cut
                        </div>
                    </div>
                </button>
            )}

            {onUnitChange && (
                <div className="relative group/units">
                    <button
                        className="p-2 text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors uppercase w-10 text-center"
                    >
                        {units}
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-16 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden hidden group-hover/units:block p-1">
                        {['mm', 'cm', 'in', 'ft'].map((u) => (
                            <button
                                key={u}
                                onClick={() => onUnitChange(u as any)}
                                className={`block w-full text-center px-1 py-1.5 text-[10px] uppercase rounded hover:bg-slate-800 transition ${u === units ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}
                            >
                                {u}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Divider if we have advanced controls */}
            {(onClippingChange || onUnitChange) && <div className="w-px h-6 bg-slate-700 mx-1" />}

            {/* Active tool name */}
            <span className="text-xs font-medium text-slate-400 px-2 min-w-[70px]">
                {TOOLS.find(t => t.id === activeTool)?.label}
            </span>
        </div>
    )
})

export default ViewerToolbar
