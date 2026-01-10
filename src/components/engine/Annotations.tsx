'use client'

/**
 * Annotation Components
 * 
 * 3D annotations for marking up CAD models.
 * Optimized with memo and minimal re-renders.
 */

import React, { memo, useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { COLORS } from '@/lib/config'
import type { Annotation } from './types'

type AnnotationMarkerProps = {
    annotation: Annotation
    index: number
    isSelected: boolean
    onSelect: (annotation: Annotation) => void
    onResolve?: (id: string) => void
}

/**
 * Single annotation marker in 3D space
 */
export const AnnotationMarker = memo(function AnnotationMarker({
    annotation,
    index,
    isSelected,
    onSelect,
    onResolve,
}: AnnotationMarkerProps) {
    const isResolved = annotation.status === 'resolved'
    const isCloud = annotation.type === 'cloud'

    // Determine colors based on state
    const bgColor = isResolved
        ? 'bg-emerald-500'
        : isCloud
            ? 'bg-rose-500'
            : 'bg-indigo-500'

    const borderColor = isResolved
        ? 'border-emerald-300'
        : isCloud
            ? 'border-rose-300'
            : 'border-indigo-300'

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        onSelect(annotation)
    }, [annotation, onSelect])

    const handleResolve = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        onResolve?.(annotation.id)
    }, [annotation.id, onResolve])

    return (
        <Html position={annotation.position} style={{ pointerEvents: 'auto' }}>
            {/* 
                Container is centered horizontally (-translate-x-1/2) 
                and moved up (-translate-y-full) so the bottom touches the 3D point 
            */}
            <div className="relative select-none flex flex-col items-center transform -translate-x-1/2 -translate-y-full">

                {/* Pin marker (Bubble) */}
                <button
                    onClick={handleClick}
                    className={`
                        w-8 h-8 rounded-full flex items-center justify-center 
                        text-sm font-bold shadow-xl cursor-pointer 
                        transition-all duration-150 border-2 text-white z-10
                        ${bgColor} ${borderColor}
                        ${isSelected ? 'scale-125 ring-4 ring-white/40' : 'hover:scale-110'}
                    `}
                    aria-label={`Annotation ${index + 1}`}
                >
                    {isResolved ? '✓' : index + 1}
                </button>

                {/* Expanded card on selection (positioned relative to button) */}
                {isSelected && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[calc(100%+10px)] w-72 z-50 animate-fadeIn">
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-4 shadow-2xl">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-2">
                                <span className={`text-[10px] uppercase font-bold tracking-wider ${isResolved ? 'text-emerald-400' : 'text-slate-400'}`}>
                                    {isResolved ? '✓ Resolved' : isCloud ? '☁ Issue' : '💬 Note'}
                                </span>
                            </div>

                            {/* Comment text */}
                            <p className="text-sm text-slate-200 mb-3 break-words leading-relaxed">
                                {annotation.text}
                            </p>

                            {/* Resolve button */}
                            {!isResolved && onResolve && (
                                <button
                                    onClick={handleResolve}
                                    className="w-full text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-md transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    <span>✓</span> Mark as Resolved
                                </button>
                            )}
                        </div>

                        {/* Arrow pointer pointing down to bubble */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-900/95" />
                    </div>
                )}

                {/* Pin stick (Line connecting bubble to point) */}
                <div className="w-0.5 h-8 bg-white shadow-[0_0_2px_rgba(0,0,0,0.5)] -mt-1" />

                {/* Dot at the actual 3D point contact */}
                <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
            </div>
        </Html>
    )
})

type AnnotationsLayerProps = {
    annotations: Annotation[]
    onSelect?: (annotation: Annotation) => void
    onResolve?: (id: string) => void
}

/**
 * Layer containing all annotation markers
 */
export const AnnotationsLayer = memo(function AnnotationsLayer({
    annotations,
    onSelect,
    onResolve
}: AnnotationsLayerProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const handleSelect = useCallback((annotation: Annotation) => {
        const newId = selectedId === annotation.id ? null : annotation.id
        setSelectedId(newId)
        if (newId) onSelect?.(annotation)
    }, [selectedId, onSelect])

    const handleResolve = useCallback((id: string) => {
        onResolve?.(id)
        setSelectedId(null)
    }, [onResolve])

    return (
        <group name="annotations-layer">
            {annotations.map((ann, idx) => (
                <AnnotationMarker
                    key={ann.id}
                    annotation={ann}
                    index={idx}
                    isSelected={selectedId === ann.id}
                    onSelect={handleSelect}
                    onResolve={onResolve}
                />
            ))}
        </group>
    )
})

type AnnotationInputProps = {
    position: [number, number, number]
    onSave: (text: string) => void
    onCancel: () => void
}

/**
 * Inline annotation text input
 */
export const AnnotationInput = memo(function AnnotationInput({
    position,
    onSave,
    onCancel
}: AnnotationInputProps) {
    const [text, setText] = useState('')

    const handleSave = useCallback(() => {
        if (text.trim()) {
            onSave(text.trim())
        }
    }, [text, onSave])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSave()
        } else if (e.key === 'Escape') {
            onCancel()
        }
    }, [handleSave, onCancel])

    return (
        <Html position={position} style={{ pointerEvents: 'auto' }}>
            <div className="bg-slate-900 p-4 rounded-lg shadow-2xl border border-slate-700 w-64 transform -translate-x-1/2 -translate-y-[120%] animate-slideIn">
                <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">
                    Add Comment
                </div>

                <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-slate-800 text-white p-2 rounded border border-slate-600 focus:border-indigo-500 outline-none text-sm min-h-[80px] mb-3 resize-none"
                    placeholder="Type observation... (Ctrl+Enter to save)"
                />

                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs text-slate-300 hover:text-white transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!text.trim()}
                        className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition"
                    >
                        Save
                    </button>
                </div>

                {/* Arrow */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-4 h-4 bg-slate-900 border-r border-b border-slate-700" />
            </div>

            {/* Marker dot */}
            <div className="w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2" />
        </Html>
    )
})

export default AnnotationsLayer
