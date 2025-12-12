
'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import PDFViewer from '@/components/PDFViewer'
import type { CadViewerRef, Annotation } from '@/components/CadViewer'
import { useAnnotations } from '@/hooks/useAnnotations'
import CommentsSidebar from '@/components/CommentsSidebar'
import { projectPoint } from '@/lib/projectionUtils'
import { demoStore } from '@/lib/demoStore'
import ViewerToolbar, { ToolType } from '@/components/ViewerToolbar'

// Dynamically import CadViewer with no SSR
const CadViewer = dynamic(() => import('@/components/CadViewer'), {
    ssr: false,
    loading: () => <div className="text-white flex items-center justify-center h-full">Loading 3D Engine...</div>
})

export default function ViewPage({ params }: { params: { id: string } }) {
    const searchParams = useSearchParams()
    const name = searchParams.get('name') || 'Unknown File'
    const type = searchParams.get('type') || '3D'
    const isLocal = searchParams.get('local') === 'true'

    const { id } = React.use(params) as { id: string }

    const { annotations, createAnnotation } = useAnnotations(id)

    const viewerRef = useRef<CadViewerRef>(null)
    const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
    const [localUrl, setLocalUrl] = useState<string>('')
    const [activeTool, setActiveTool] = useState<ToolType>('select')

    useEffect(() => {
        if (isLocal) {
            const demoFile = demoStore.getFile(id)
            if (demoFile) {
                setLocalUrl(demoFile.url)
            } else {
                console.error('Demo file not found in memory store', id)
            }
        }
    }, [id, isLocal])

    const fileUrl = isLocal
        ? localUrl
        : (type === '3D'
            ? 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'
            : `https://example.com/files/${id}/${name}`)

    const handleAnnotate = async (
        data: { position: [number, number, number]; normal: [number, number, number] },
        tool: ToolType
    ) => {
        const text = prompt('Enter annotation text:')
        if (!text) return

        try {
            await createAnnotation(data, text)
        } catch (e: any) {
            console.error(e)
            alert('Annotation failed (Backend might be offline): ' + e.message)
        }
    }

    const handleSnapshot = async () => {
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
            console.error(err)
            alert('Snapshot failed: ' + err.message)
        }
    }

    if (isLocal && !localUrl) {
        return <div className="h-screen flex items-center justify-center text-white bg-slate-950">Loading local file...</div>
    }

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden relative">
            {/* Navbar */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-6">
                    <Link href="/" className="group flex items-center gap-2 text-slate-400 hover:text-white transition text-sm font-medium">
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                        Back
                    </Link>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div>
                        <h1 className="font-semibold text-sm tracking-wide text-slate-100">{name}</h1>
                        <p className="text-xs text-slate-500">ID: {id}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${type === '3D' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                        {type}
                    </span>
                    {isLocal && <span className="text-xs bg-yellow-900/50 text-yellow-500 px-2 py-0.5 rounded ml-2">Local Demo</span>}
                </div>

                {/* TOOLBAR CENTERED */}
                <div className="absolute left-1/2 -translate-x-1/2 top-2">
                    <ViewerToolbar activeTool={activeTool} onToolChange={setActiveTool} />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleSnapshot}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs font-medium hover:bg-slate-700 transition"
                    >
                        Snapshot
                    </button>
                    <button className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/20">
                        Share View
                    </button>
                </div>
            </header>

            {/* Main View Area */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden">
                {type === 'PDF' ? (
                    <div className="absolute inset-0 p-8 flex items-center justify-center bg-slate-900/50">
                        <div className="w-full max-w-5xl h-full bg-white text-black rounded-lg shadow-2xl overflow-hidden ring-1 ring-white/10">
                            <PDFViewer url={fileUrl} />
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
                        ref={viewerRef}
                    />
                )}

                {selectedAnnotation && (
                    <CommentsSidebar
                        selectedAnnotation={selectedAnnotation}
                        onClose={() => setSelectedAnnotation(null)}
                    />
                )}
            </div>

            {/* Remove Overlay Instructions (Tools serve this purpose now) */}
        </div>
    )
}
