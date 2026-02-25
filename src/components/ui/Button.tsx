'use client'

import React from 'react'
import type { ButtonVariant } from '@/types'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    icon?: React.ReactNode
    iconRight?: React.ReactNode
}

const BASE =
    'inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1623] disabled:opacity-40 disabled:cursor-not-allowed'

const VARIANTS: Record<ButtonVariant, string> = {
    primary:
        'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-900/30',
    secondary:
        'bg-[#141c2b] text-slate-200 border border-white/8 hover:bg-[#1a2436] hover:border-white/12 active:bg-[#111827]',
    ghost:
        'text-slate-400 hover:text-white hover:bg-white/5 active:bg-white/8',
    danger:
        'bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white hover:border-transparent',
}

const SIZES: Record<string, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-11 px-6 text-sm',
}

export default function Button({
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    children,
    disabled,
    className = '',
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
            {...props}
        >
            {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
            ) : icon ? (
                <span className="w-4 h-4 flex-shrink-0">{icon}</span>
            ) : null}
            {children}
            {!loading && iconRight && <span className="w-4 h-4 flex-shrink-0">{iconRight}</span>}
        </button>
    )
}
