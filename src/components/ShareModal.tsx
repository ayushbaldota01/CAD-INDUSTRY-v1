
'use client'

import React, { useState, useEffect } from 'react'

interface ShareModalProps {
    fileId: string
    fileName: string
    onClose: () => void
}

export default function ShareModal({ fileId, fileName, onClose }: ShareModalProps) {
    const [accessMode, setAccessMode] = useState<'read-only' | 'comment-only'>('read-only')
    const [expiresInDays, setExpiresInDays] = useState(7)
    const [shareUrl, setShareUrl] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)

    // Keyboard support
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [loading, onClose])

    const generateLink = async () => {
        if (loading) return // Prevent duplicate clicks
        setLoading(true)
        try {
            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId,
                    accessMode,
                    expiresInDays: expiresInDays || null
                })
            })

            const data = await res.json()

            if (res.ok) {
                setShareUrl(data.shareUrl)
            } else {
                alert('Failed to generate share link: ' + data.error)
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !loading) {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-800">
                    <div>
                        <h3 className="font-semibold text-white">Share File</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{fileName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="text-slate-400 hover:text-white transition p-1 disabled:opacity-50"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Access Mode */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Access Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setAccessMode('read-only')}
                                disabled={loading}
                                className={`p-3 rounded-lg border transition ${accessMode === 'read-only'
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                    } disabled:opacity-50`}
                            >
                                <div className="text-2xl mb-1">👁️</div>
                                <div className="text-xs font-medium">Read Only</div>
                            </button>
                            <button
                                onClick={() => setAccessMode('comment-only')}
                                disabled={loading}
                                className={`p-3 rounded-lg border transition ${accessMode === 'comment-only'
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                    } disabled:opacity-50`}
                            >
                                <div className="text-2xl mb-1">✏️</div>
                                <div className="text-xs font-medium">Comment Only</div>
                            </button>
                        </div>
                    </div>

                    {/* Expiration */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Link Expires In
                        </label>
                        <select
                            value={expiresInDays}
                            onChange={(e) => setExpiresInDays(Number(e.target.value))}
                            disabled={loading}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                        >
                            <option value={1}>1 day</option>
                            <option value={3}>3 days</option>
                            <option value={7}>7 days</option>
                            <option value={14}>14 days</option>
                            <option value={30}>30 days</option>
                            <option value={0}>Never</option>
                        </select>
                    </div>

                    {/* Generate Button */}
                    {!shareUrl && (
                        <button
                            onClick={generateLink}
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                        >
                            {loading ? '⏳ Generating...' : '🔗 Generate Share Link'}
                        </button>
                    )}

                    {/* Share URL */}
                    {shareUrl && (
                        <div className="space-y-2">
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                <p className="text-xs text-slate-400 mb-1">Share Link:</p>
                                <p className="text-sm text-white font-mono break-all">{shareUrl}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={copyToClipboard}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-medium transition text-sm"
                                >
                                    {copied ? '✓ Copied!' : '📋 Copy Link'}
                                </button>
                                <button
                                    onClick={() => setShareUrl('')}
                                    className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-sm"
                                >
                                    New Link
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-800/50">
                    <p className="text-xs text-slate-400 text-center">
                        🔒 Links can be revoked anytime from the file settings
                    </p>
                </div>
            </div>
        </div>
    )
}
