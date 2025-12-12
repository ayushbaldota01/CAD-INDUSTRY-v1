
'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuidv4 } from 'uuid'

// Configure worker (use a CDN for simplicity in this environment to ensure it works without complex build config)
// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export type OverlayItem = {
    id: string
    type: 'callout' | 'text' | 'arrow' | 'freehand' | 'dimension'
    points: { x: number; y: number }[] // Normalized 0..1
    text?: string
    color?: string
}

type Props = {
    pdfUrl: string
    overlayJson?: OverlayItem[]
    onSaveOverlay: (items: OverlayItem[]) => void
}

export default function PdfAnnotator({ pdfUrl, overlayJson = [], onSaveOverlay }: Props) {
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [scale, setScale] = useState(1.0)
    const [items, setItems] = useState<OverlayItem[]>(overlayJson)
    const [tool, setTool] = useState<OverlayItem['type'] | 'none'>('none')
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([])

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [viewportDims, setViewportDims] = useState({ width: 0, height: 0 })

    // Load PDF
    useEffect(() => {
        const loadPdf = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument(pdfUrl)
                const doc = await loadingTask.promise
                setPdf(doc)
            } catch (err) {
                console.error('Error loading PDF:', err)
            }
        }
        if (pdfUrl) loadPdf()
    }, [pdfUrl])

    // Render Page
    useEffect(() => {
        if (!pdf || !canvasRef.current) return

        const renderPage = async () => {
            const page = await pdf.getPage(pageNumber)
            const viewport = page.getViewport({ scale })

            const canvas = canvasRef.current!
            const context = canvas.getContext('2d')

            canvas.height = viewport.height
            canvas.width = viewport.width
            setViewportDims({ width: viewport.width, height: viewport.height })

            if (context) {
                await page.render({ canvasContext: context, viewport }).promise
            }
        }
        renderPage()
    }, [pdf, pageNumber, scale])

    // Coords handling
    const getNormCoords = (e: React.MouseEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 }
        const rect = containerRef.current.getBoundingClientRect()
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
        }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (tool === 'none') return
        const coords = getNormCoords(e)
        setCurrentPath([coords])
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (tool === 'none' || currentPath.length === 0) return

        const coords = getNormCoords(e)

        if (tool === 'freehand') {
            setCurrentPath(prev => [...prev, coords])
        } else {
            // For click-drag shapes (arrow, dimension), just update end point
            setCurrentPath([currentPath[0], coords])
        }
    }

    const handleMouseUp = () => {
        if (tool === 'none' || currentPath.length === 0) return

        let newItem: OverlayItem = {
            id: uuidv4(),
            type: tool,
            points: currentPath,
            color: 'red'
        }

        if (tool === 'callout' || tool === 'text') {
            const text = prompt('Enter annotation text:')
            if (text) newItem.text = text
            else return // Cancel if no text
        }

        setItems(prev => [...prev, newItem])
        setCurrentPath([])
    }

    const handleSave = () => {
        onSaveOverlay(items)
    }

    const renderOverlayItem = (item: OverlayItem, index?: number) => {
        const w = viewportDims.width
        const h = viewportDims.height

        const denorm = (p: { x: number, y: number }) => ({ x: p.x * w, y: p.y * h })

        switch (item.type) {
            case 'freehand':
                const pathData = item.points.map((p, i) => {
                    const dp = denorm(p)
                    return `${i === 0 ? 'M' : 'L'} ${dp.x} ${dp.y}`
                }).join(' ')
                return <path key={item.id} d={pathData} stroke={item.color} strokeWidth="2" fill="none" />

            case 'arrow':
                if (item.points.length < 2) return null
                const start = denorm(item.points[0])
                const end = denorm(item.points[item.points.length - 1])
                return (
                    <g key={item.id}>
                        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={item.color} strokeWidth="2" markerEnd="url(#arrowhead)" />
                    </g>
                )

            case 'dimension':
                if (item.points.length < 2) return null
                const dStart = denorm(item.points[0])
                const dEnd = denorm(item.points[item.points.length - 1])
                return (
                    <g key={item.id}>
                        <line x1={dStart.x} y1={dStart.y} x2={dEnd.x} y2={dEnd.y} stroke="blue" strokeWidth="2" />
                        <text x={(dStart.x + dEnd.x) / 2} y={(dStart.y + dEnd.y) / 2} fill="blue" fontSize="12">
                            Dist
                        </text>
                    </g>
                )

            case 'text':
            case 'callout':
                if (item.points.length === 0) return null
                const p = denorm(item.points[0])
                return (
                    <text key={item.id} x={p.x} y={p.y} fill="red" fontSize="14" fontWeight="bold">
                        {item.text || 'Annotation'}
                    </text>
                )

            default: return null
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            {/* Toolbar */}
            <div className="flex gap-2 p-2 bg-slate-800 border-b border-slate-700">
                <button onClick={() => setTool('none')} className={`px-3 py-1 rounded ${tool === 'none' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Select</button>
                <button onClick={() => setTool('freehand')} className={`px-3 py-1 rounded ${tool === 'freehand' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Draw</button>
                <button onClick={() => setTool('arrow')} className={`px-3 py-1 rounded ${tool === 'arrow' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Arrow</button>
                <button onClick={() => setTool('text')} className={`px-3 py-1 rounded ${tool === 'text' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Text</button>
                <button onClick={() => setTool('dimension')} className={`px-3 py-1 rounded ${tool === 'dimension' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Dimension</button>
                <div className="flex-1" />
                <button onClick={handleSave} className="px-4 py-1 bg-green-600 rounded hover:bg-green-500">Save Overlay</button>
            </div>

            {/* Viewer Area */}
            <div className="flex-1 overflow-auto flex justify-center p-8 relative bg-slate-950">
                <div
                    ref={containerRef}
                    className="relative shadow-2xl"
                    style={{ width: viewportDims.width, height: viewportDims.height }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    <canvas ref={canvasRef} className="absolute inset-0" />

                    <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="red" />
                            </marker>
                        </defs>
                        {items.map((item) => renderOverlayItem(item))}

                        {/* Current drawing path */}
                        {currentPath.length > 0 && renderOverlayItem({
                            id: 'temp',
                            type: tool as any,
                            points: currentPath,
                            color: 'rgba(255, 0, 0, 0.5)'
                        })}
                    </svg>
                </div>
            </div>
        </div>
    )
}
