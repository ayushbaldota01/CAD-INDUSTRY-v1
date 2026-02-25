'use client'

import React, { useState, useRef, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

type ConfirmDialogProps = {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void | Promise<void>
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary',
}: ConfirmDialogProps) {
    const [loading, setLoading] = useState(false)

    const handleConfirm = async () => {
        setLoading(true)
        try {
            await onConfirm()
            onClose()
        } catch {
            // errors handled by caller
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
            <p className="text-slate-300 text-sm mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={onClose} disabled={loading}>
                    {cancelLabel}
                </Button>
                <Button
                    variant={variant === 'danger' ? 'danger' : 'primary'}
                    onClick={handleConfirm}
                    loading={loading}
                >
                    {confirmLabel}
                </Button>
            </div>
        </Modal>
    )
}

// ─── Input Dialog ─────────────────────────────────────────────────────────────
// Replaces native prompt() calls

type InputDialogProps = {
    isOpen: boolean
    onClose: () => void
    onSubmit: (value: string) => void | Promise<void>
    title: string
    label: string
    placeholder?: string
    defaultValue?: string
    submitLabel?: string
    type?: 'text' | 'number' | 'email'
    required?: boolean
}

export function InputDialog({
    isOpen,
    onClose,
    onSubmit,
    title,
    label,
    placeholder,
    defaultValue = '',
    submitLabel = 'Submit',
    type = 'text',
    required = true,
}: InputDialogProps) {
    const [value, setValue] = useState(defaultValue)
    const [loading, setLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset & focus on open
    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen, defaultValue])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (required && !value.trim()) return
        setLoading(true)
        try {
            await onSubmit(value.trim())
            onClose()
        } catch {
            // errors handled by caller
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
                    <input
                        ref={inputRef}
                        type={type}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        className="input"
                        required={required}
                    />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                    <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" loading={loading}>
                        {submitLabel}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

// ─── Alert Dialog ─────────────────────────────────────────────────────────────
// Replaces native alert() calls

type AlertDialogProps = {
    isOpen: boolean
    onClose: () => void
    title: string
    message: string
    variant?: 'info' | 'success' | 'warning' | 'error'
}

const ICONS = {
    info: { icon: 'ℹ️', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    success: { icon: '✅', color: 'text-green-400', bg: 'bg-green-500/10' },
    warning: { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    error: { icon: '❌', color: 'text-red-400', bg: 'bg-red-500/10' },
}

export function AlertDialog({ isOpen, onClose, title, message, variant = 'info' }: AlertDialogProps) {
    const config = ICONS[variant]

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
            <div className="text-center">
                <div className={`w-14 h-14 ${config.bg} rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl`}>
                    {config.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-400 mb-6">{message}</p>
                <Button variant="primary" onClick={onClose} className="w-full">
                    OK
                </Button>
            </div>
        </Modal>
    )
}
