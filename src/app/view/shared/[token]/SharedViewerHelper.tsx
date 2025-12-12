
'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import PDFViewer from '@/components/PDFViewer'
import type { CadViewerRef, Annotation } from '@/components/CadViewer'
import CommentsSidebar from '@/components/CommentsSidebar'

// Re-use CadViewer dynamically
const CadViewer = dynamic(() => import('@/components/CadViewer'), {
    ssr: false,
    loading: () => <div className="text-white flex items-center justify-center h-full">Loading Shared Model...</div>
})

export default function SharedViewerHelper({
    model,
    fileUrl,
    initialAnnotations,
    role
}: {
    model: any,
    fileUrl: string,
    initialAnnotations: any[],
    role: string
}) {
    // Local State
    const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
    const viewerRef = useRef<CadViewerRef>(null)

    // No creation allowed in shared view for now (read-only mostly)
    const handleAnnotate = () => {
        if (role === 'editor') {
            alert('Editor mode not fully implemented in shared view yet.')
        }
    }

    return (
        <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden relative">
            {/* Header */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs font-mono uppercase tracking-wider">
                        Shared View
                    </div>
                    <div>
                        <h1 className="font-semibold text-sm tracking-wide text-slate-100">{model.name}</h1>
                        <p className="text-xs text-slate-500">Access: {role}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link href="/login" className="text-xs text-slate-400 hover:text-white transition">
                        Log In to Edit
                    </Link>
                </div>
            </header>

            {/* Viewer */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden">
                {model.file_type === 'pdf' ? (
                    <div className="absolute inset-0 p-8 flex items-center justify-center bg-slate-900/50">
                        <div className="w-full max-w-5xl h-full bg-white text-black rounded-lg shadow-2xl overflow-hidden ring-1 ring-white/10">
                            <PDFViewer url={fileUrl} />
                        </div>
                    </div>
                ) : (
                    <CadViewer
                        modelUrl={fileUrl}
                        annotations={initialAnnotations} // Passed from server
                        onAnnotate={handleAnnotate}
                        onAnnotationSelect={(ann) => setSelectedAnnotation(ann)}
                        ref={viewerRef}
                    />
                )}

                {/* Minimal Comment Viewing (optional, simplistic version) */}
                {selectedAnnotation && (
                    <div className="absolute top-0 right-0 h-full w-80 bg-slate-900 border-l border-slate-800 shadow-2xl p-4 z-20">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                            <h3 className="font-semibold text-sm">Annotation</h3>
                            <button onClick={() => setSelectedAnnotation(null)} className="text-white">✕</button>
                        </div>
                        <p className="text-sm bg-slate-800 p-3 rounded mb-4">{selectedAnnotation.text}</p>
                        <div className="bg-blue-900/20 p-4 rounded text-xs text-blue-200 text-center">
                            Sign in to view comments/reply.
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
