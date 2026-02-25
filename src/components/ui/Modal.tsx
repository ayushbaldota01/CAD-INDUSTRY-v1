'use client'

import React, { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
    isOpen: boolean
    onClose: () => void
    title?: string
    description?: string
    children: React.ReactNode
    maxWidth?: 'sm' | 'md' | 'lg'
    /** If true, clicking the backdrop does NOT close the modal */
    persistent?: boolean
}

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

export default function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    maxWidth = 'md',
    persistent = false,
}: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    // Keyboard close
    const handleKey = useCallback(
        (e: KeyboardEvent) => { if (e.key === 'Escape' && !persistent) onClose() },
        [onClose, persistent]
    )

    useEffect(() => {
        if (!isOpen) return
        document.addEventListener('keydown', handleKey)
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = ''
        }
    }, [isOpen, handleKey])

    if (!isOpen) return null

    const content = (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={persistent ? undefined : (e) => { if (e.target === overlayRef.current) onClose() }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

            {/* Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
                className={`relative w-full ${WIDTHS[maxWidth]} bg-[#0f1623] border border-white/8 rounded-2xl shadow-2xl animate-scale-in`}
            >
                {/* Header */}
                {(title || !persistent) && (
                    <div className="flex items-start justify-between px-6 pt-6 pb-0">
                        <div>
                            {title && (
                                <h2 id="modal-title" className="text-lg font-semibold text-white">
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <p className="text-sm text-slate-400 mt-1">{description}</p>
                            )}
                        </div>
                        {!persistent && (
                            <button
                                onClick={onClose}
                                className="ml-4 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition"
                                aria-label="Close"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="px-6 py-6">{children}</div>
            </div>
        </div>
    )

    return typeof window !== 'undefined' ? createPortal(content, document.body) : null
}
