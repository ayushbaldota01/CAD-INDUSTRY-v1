
'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import PDFViewer from '@/components/PDFViewer'
import type { CadViewerRef, Annotation } from '@/components/CadViewer'

// Dynamically import CadViewer
const CadViewer = dynamic(() => import('@/components/CadViewer'), {
    ssr: false,
    loading: () => <div className="text-white flex items-center justify-center h-full">Loading Shared Model...</div>
})

interface SharedViewerClientProps {
    file: any
    fileUrl: string
    initialAnnotations: any[]
    accessMode: 'read-only' | 'comment-only'
    shareToken: string
}

export default function SharedViewerClient({
    file,
    fileUrl,
    initialAnnotations,
    accessMode,
    shareToken
}: SharedViewerClientProps) {
    const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
    const viewerRef = useRef<CadViewerRef>(null)

    // Map annotations to viewer format
    const annotations: Annotation[] = initialAnnotations.map((ann: any) => ({
        id: ann.id,
        text: ann.text,
        position: ann.position && typeof ann.position === 'object'
            ? [ann.position.x || 0, ann.position.y || 0, ann.position.z || 0] as [number, number, number]
            : [0, 0, 0] as [number, number, number],
        normal: [0, 1, 0] as [number, number, number],
        type: (ann.type === 'bubble' ? 'note' : 'cloud') as 'note' | 'cloud'
    }))

    const handleAnnotate = () => {
        if (accessMode === 'read-only') {
            alert('This is a read-only share link. Annotations are disabled.')
        } else {
            alert('Comment-only mode: Annotation feature coming soon for shared links.')
        }
    }

    const isPDF = file.type === 'pdf'

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden relative">
            {/* Header */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-mono uppercase tracking-wider border border-indigo-500/30">
                        🔗 Shared View
                    </div>
                    <div>
                        <h1 className="font-semibold text-sm tracking-wide text-slate-100">{file.name}</h1>
                        <p className="text-xs text-slate-500">
                            Access: <span className={`font-medium ${accessMode === 'read-only' ? 'text-slate-400' : 'text-blue-400'
                                }`}>
                                {accessMode === 'read-only' ? '👁️ Read Only' : '✏️ Comment Only'}
                            </span>
                        </p>
                    </div>
                    {file.version > 1 && (
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                            v{file.version}
                        </span>
                    )}
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/login"
                        className="text-xs text-slate-400 hover:text-white transition px-3 py-1.5 hover:bg-slate-800 rounded"
                    >
                        Sign In for Full Access
                    </Link>
                </div>
            </header>

            {/* Viewer */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden">
                {isPDF ? (
                    <div className="absolute inset-0 p-8 flex items-center justify-center bg-slate-900/50">
                        <div className="w-full max-w-5xl h-full bg-white text-black rounded-lg shadow-2xl overflow-hidden ring-1 ring-white/10">
                            <PDFViewer url={fileUrl} modelId={file.id} />
                        </div>
                    </div>
                ) : (
                    <CadViewer
                        modelUrl={fileUrl}
                        modelName={file.name}
                        annotations={annotations}
                        activeTool="select"
                        onAnnotate={handleAnnotate}
                        onAnnotationSelect={(ann) => setSelectedAnnotation(ann)}
                        ref={viewerRef}
                    />
                )}

                {/* Annotation Detail (if selected) */}
                {selectedAnnotation && (
                    <div className="absolute top-0 right-0 h-full w-80 bg-slate-900 border-l border-slate-800 shadow-2xl p-4 z-20">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                            <h3 className="font-semibold text-sm">Annotation</h3>
                            <button onClick={() => setSelectedAnnotation(null)} className="text-white hover:text-slate-400">✕</button>
                        </div>
                        <p className="text-sm bg-slate-800 p-3 rounded mb-4">{selectedAnnotation.text}</p>
                        <div className="bg-blue-900/20 p-4 rounded text-xs text-blue-200 text-center">
                            {accessMode === 'read-only'
                                ? 'Read-only access. Sign in to comment.'
                                : 'Comment-only access. Sign in for full features.'}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-center">
                <p className="text-xs text-slate-500">
                    Shared via secure link • {accessMode === 'read-only' ? 'View only' : 'Comments enabled'}
                </p>
            </div>
        </div>
    )
}
