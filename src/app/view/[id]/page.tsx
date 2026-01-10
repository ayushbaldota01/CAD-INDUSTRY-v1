'use client'

/**
 * View Page - 3D and PDF Viewer
 * 
 * Optimized for performance with the new engine.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import PDFViewer from '@/components/PDFViewer'
import type { CadViewerRef, Annotation } from '@/components/CadViewer'
import { useAnnotations } from '@/hooks/useAnnotations'
import CommentsSidebar from '@/components/CommentsSidebar'
import ActivitySidebar from '@/components/ActivitySidebar'
import ShareModal from '@/components/ShareModal'
import ExportModal from '@/components/ExportModal'
import { projectPoint } from '@/lib/projectionUtils'
import { demoStore } from '@/lib/demoStore'
import { supabase } from '@/lib/supabaseClient'
import ViewerToolbar, { ToolType } from '@/components/ViewerToolbar'
import { useUserRole } from '@/hooks/useUserRole'
import { FALLBACK_MODEL_URL } from '@/lib/config'

// Dynamically import CadViewer with no SSR
const CadViewer = dynamic(() => import('@/components/CadViewer'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
            <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-white font-medium">Loading 3D Engine...</div>
                <div className="text-slate-400 text-sm mt-1">Please wait</div>
            </div>
        </div>
    )
})

// Lighter fallback model (simple box from a smaller file)
const LIGHT_FALLBACK_MODEL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Box/glTF-Binary/Box.glb'

export default function ViewPage({ params }: { params: Promise<{ id: string }> }) {
    const searchParams = useSearchParams()
    const name = searchParams.get('name') || 'Unknown File'
    const type = searchParams.get('type') || '3D'
    const isLocal = searchParams.get('local') === 'true'

    const { id } = React.use(params)

    const { annotations, createAnnotation, updateAnnotation } = useAnnotations(id)
    const { permissions, role } = useUserRole()

    const viewerRef = useRef<CadViewerRef>(null)
    const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
    const [showActivityLog, setShowActivityLog] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    const [showExportModal, setShowExportModal] = useState(false)
    const [localUrl, setLocalUrl] = useState<string>('')
    const [remoteUrl, setRemoteUrl] = useState<string>('')
    const [fileData, setFileData] = useState<any>(null)
    const [versions, setVersions] = useState<any[]>([])
    const [activeTool, setActiveTool] = useState<ToolType>('select')
    const [fileMissing, setFileMissing] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    // Fetch file details and versions if not local
    useEffect(() => {
        if (isLocal || !id) return

        const loadRemote = async () => {
            try {
                const { data, error } = await supabase
                    .from('files')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (error || !data) {
                    console.warn('File not found in database, using fallback')
                    return
                }

                setFileData(data)

                // Get signed URL
                if (data.storage_path) {
                    try {
                        const { data: signed } = await supabase.storage
                            .from('cad-files')
                            .createSignedUrl(data.storage_path, 3600 * 24)

                        if (signed?.signedUrl) {
                            setRemoteUrl(signed.signedUrl)
                        }
                    } catch (e) {
                        console.warn('Could not get signed URL:', e)
                    }
                }

                // Fetch versions
                try {
                    const res = await fetch(`/api/files/${id}/versions`)
                    const json = await res.json()
                    if (json.versions) setVersions(json.versions)
                } catch (e) {
                    // Versions API might not exist
                }
            } catch (e) {
                console.warn('Error loading remote file:', e)
            }
        }

        loadRemote()
    }, [id, isLocal])

    // Load local file from demo store
    useEffect(() => {
        if (!isLocal) return

        const demoFile = demoStore.getFile(id)
        if (demoFile) {
            setLocalUrl(demoFile.url)
        } else {
            console.warn('Demo file not found in memory store:', id)
            setFileMissing(true)
        }
    }, [id, isLocal])

    // Determine final URL
    const fileUrl = isLocal
        ? localUrl
        : remoteUrl || (type === '3D' ? LIGHT_FALLBACK_MODEL : `https://example.com/files/${id}/${name}`)

    // Handle annotation creation
    const handleAnnotate = useCallback(async (
        data: { position: [number, number, number]; normal: [number, number, number] },
        text: string
    ) => {
        if (!permissions.canComment) {
            alert(`You need 'reviewer' or 'admin' role to add annotations. Your role: ${role}`)
            return
        }

        try {
            await createAnnotation(data, text)
        } catch (e: any) {
            console.error('Annotation failed:', e)
            alert('Annotation failed: ' + e.message)
        }
    }, [permissions.canComment, role, createAnnotation])

    // Handle snapshot
    const handleSnapshot = useCallback(async () => {
        if (!viewerRef.current) return

        try {
            const imageData = viewerRef.current.takeSnapshot()
            const camera = viewerRef.current.exportCamera()

            const projectedAnnotations = annotations.map(ann => {
                const projection = projectPoint(camera, ann.position)
                if (projection) {
                    return { id: ann.id, u: projection.u, v: projection.v }
                }
                return null
            }).filter(Boolean)

            const targetId = id === 'demo' ? 'demo-model-id' : id

            const res = await fetch('/api/snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelId: targetId,
                    imageData,
                    camera,
                    annotations: projectedAnnotations
                })
            })

            const json = await res.json()

            if (res.ok) {
                alert(`Snapshot saved! URL: ${json.url}`)
            } else {
                throw new Error(json.error)
            }
        } catch (err: any) {
            console.error('Snapshot error:', err)
            alert('Snapshot failed: ' + err.message)
        }
    }, [annotations, id])

    // Handle viewer error
    const handleViewerError = useCallback((error: Error) => {
        console.error('Viewer error:', error)
        setLoadError(error.message)
    }, [])

    // Demo file expired state
    if (isLocal && fileMissing) {
        return (
            <div className="h-screen flex flex-col items-center justify-center text-white bg-slate-950 gap-4">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-red-400">Demo Session Expired</h2>
                <p className="text-slate-400 max-w-md text-center">
                    The local file reference has been lost due to a page refresh.
                    Local demo files are stored in memory only.
                </p>
                <Link
                    href="/upload"
                    className="mt-4 bg-indigo-600 px-6 py-3 rounded-lg font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2"
                >
                    ⬆️ Upload Again
                </Link>
            </div>
        )
    }

    // Loading local file
    if (isLocal && !localUrl) {
        return (
            <div className="h-screen flex flex-col items-center justify-center text-white bg-slate-950">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <div className="text-slate-400 animate-pulse">Loading local file...</div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden relative">
            {/* Navbar */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-6">
                    <Link
                        href="/"
                        className="group flex items-center gap-2 text-slate-400 hover:text-white transition text-sm font-medium"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                        Back
                    </Link>

                    <div className="h-6 w-px bg-slate-700" />

                    <div>
                        <h1 className="font-semibold text-sm tracking-wide text-slate-100">{name}</h1>
                        <p className="text-xs text-slate-500">ID: {id.slice(0, 8)}...</p>
                    </div>

                    <span className={`text-xs px-2 py-0.5 rounded border ${type === '3D'
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        {type}
                    </span>

                    {isLocal && (
                        <span className="text-xs bg-yellow-900/50 text-yellow-500 px-2 py-0.5 rounded">
                            Local Demo
                        </span>
                    )}

                    {/* Version Selector */}
                    {!isLocal && versions.length > 0 && (
                        <div className="relative group ml-4 z-50">
                            <button className="flex items-center gap-2 text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded hover:bg-slate-700 transition">
                                <span className="text-slate-400">Ver:</span>
                                <span className="font-semibold text-white">v{fileData?.version || '?'}</span>
                                <span className="text-[10px] text-slate-500">▼</span>
                            </button>
                            <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden hidden group-hover:block">
                                {versions.map((v: any) => (
                                    <Link
                                        key={v.id}
                                        href={`/view/${v.id}?name=${encodeURIComponent(name)}&type=${type}`}
                                        className={`block px-4 py-3 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-800 transition ${v.id === id ? 'bg-indigo-900/20 text-indigo-400' : 'text-slate-300'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold">Version {v.version}</span>
                                            {v.id === id && (
                                                <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[10px]">Current</span>
                                            )}
                                        </div>
                                        <div className="text-slate-500 text-[10px]">
                                            {new Date(v.created_at).toLocaleString()}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Role Badge */}
                    <div className="ml-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${role === 'admin'
                            ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                            : role === 'reviewer'
                                ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                                : 'bg-slate-500/20 border-slate-500/30 text-slate-300'
                            }`}>
                            {role === 'admin' ? '👑 Admin' : role === 'reviewer' ? '✏️ Reviewer' : '👁️ Viewer'}
                        </div>
                    </div>
                </div>

                {/* TOOLBAR CENTERED (Hide for PDF) */}
                {type !== 'PDF' && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-2">
                        <ViewerToolbar
                            activeTool={activeTool}
                            onToolChange={setActiveTool}
                            canComment={permissions.canComment}
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSnapshot}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-medium hover:bg-slate-700 transition"
                    >
                        📷 Snapshot
                    </button>
                    <button
                        onClick={() => setShowActivityLog(!showActivityLog)}
                        className={`px-3 py-1.5 border rounded text-xs font-medium transition ${showActivityLog
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                    >
                        📋 Activity
                    </button>
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs font-medium hover:bg-slate-700 transition"
                    >
                        📥 Export
                    </button>
                    <button
                        onClick={() => setShowShareModal(true)}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/20"
                    >
                        🔗 Share
                    </button>
                </div>
            </header>

            {/* Main View Area */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden">
                {type === 'PDF' ? (
                    <div className="absolute inset-0 p-8 flex items-center justify-center bg-slate-900/50">
                        <div className="w-full max-w-5xl h-full bg-white text-black rounded-lg shadow-2xl overflow-hidden ring-1 ring-white/10">
                            <PDFViewer url={fileUrl} modelId={id} />
                        </div>
                    </div>
                ) : (
                    <CadViewer
                        modelUrl={fileUrl}
                        modelName={name}
                        annotations={annotations}
                        activeTool={activeTool}
                        onAnnotate={handleAnnotate}
                        onAnnotationSelect={(ann) => setSelectedAnnotation(ann)}
                        onAnnotationUpdate={updateAnnotation}
                        onError={handleViewerError}
                        ref={viewerRef}
                    />
                )}

                {/* Comments Sidebar */}
                {selectedAnnotation && (
                    <CommentsSidebar
                        selectedAnnotation={selectedAnnotation}
                        onClose={() => setSelectedAnnotation(null)}
                    />
                )}

                {/* Activity Sidebar */}
                {showActivityLog && (
                    <ActivitySidebar
                        fileId={id}
                        onClose={() => setShowActivityLog(false)}
                    />
                )}
            </div>

            {/* Modals */}
            {showShareModal && (
                <ShareModal
                    fileId={id}
                    fileName={name}
                    onClose={() => setShowShareModal(false)}
                />
            )}

            {showExportModal && (
                <ExportModal
                    fileId={id}
                    fileName={name}
                    onClose={() => setShowExportModal(false)}
                />
            )}
        </div>
    )
}
