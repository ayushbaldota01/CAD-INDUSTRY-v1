import React from 'react'
import type { BadgeVariant } from '@/types'

type BadgeProps = {
    children: React.ReactNode
    variant?: BadgeVariant
    dot?: boolean
    className?: string
}

const VARIANTS: Record<BadgeVariant, string> = {
    default: 'bg-white/6 text-slate-300 border-white/8',
    indigo: 'bg-indigo-500/12 text-indigo-300 border-indigo-500/20',
    green: 'bg-green-500/12 text-green-400 border-green-500/20',
    red: 'bg-red-500/12 text-red-400 border-red-500/20',
    yellow: 'bg-yellow-500/12 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-500/12 text-purple-300 border-purple-500/20',
}

const DOT_COLORS: Record<BadgeVariant, string> = {
    default: 'bg-slate-400',
    indigo: 'bg-indigo-400',
    green: 'bg-green-400',
    red: 'bg-red-400',
    yellow: 'bg-yellow-400',
    purple: 'bg-purple-400',
}

export default function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${VARIANTS[variant]} ${className}`}
        >
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant]}`} />}
            {children}
        </span>
    )
}
