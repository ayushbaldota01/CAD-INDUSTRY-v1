import React from 'react'

// ─── Spinner ──────────────────────────────────────────────────────────────────

type SpinnerProps = { size?: 'sm' | 'md' | 'lg'; className?: string }

const SIZES = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
const WIDTHS = { sm: '2px', md: '3px', lg: '4px' }

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
    return (
        <svg
            className={`animate-spin ${SIZES[size]} ${className}`}
            viewBox="0 0 24 24"
            fill="none"
        >
            <circle
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth={WIDTHS[size]}
                strokeOpacity="0.2"
            />
            <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth={WIDTHS[size]}
                strokeLinecap="round"
            />
        </svg>
    )
}

// ─── Full-screen loader ────────────────────────────────────────────────────────

type FullLoaderProps = { message?: string }

export function FullLoader({ message = 'Loading...' }: FullLoaderProps) {
    return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#080c14] text-slate-400">
            <Spinner size="lg" className="text-indigo-500" />
            <p className="text-sm animate-pulse">{message}</p>
        </div>
    )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

type EmptyStateProps = {
    icon?: string
    title: string
    description?: string
    action?: React.ReactNode
}

export function EmptyState({ icon = '📂', title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-white/4 rounded-2xl flex items-center justify-center text-3xl mb-4 border border-white/6">
                {icon}
            </div>
            <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
            {description && <p className="text-sm text-slate-400 max-w-xs mb-5">{description}</p>}
            {action && <div>{action}</div>}
        </div>
    )
}
