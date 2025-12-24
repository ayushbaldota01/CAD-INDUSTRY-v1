
'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuidv4 } from 'uuid'

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export type OverlayItem = {
    id: string
    type: 'callout' | 'text' | 'arrow' | 'freehand' | 'dimension' | 'highlight'
    points: { x: number; y: number }[] // Normalized 0..1
    page?: number
    text?: string
    color?: string
}

type Props = {
    pdfUrl: string
    overlayJson?: OverlayItem[]
    onSaveAnnotation?: (item: OverlayItem) => void
    onSaveOverlay?: (items: OverlayItem[]) => void // Keep backward compat if needed, or remove
}

export default function PdfAnnotator({ pdfUrl, overlayJson = [], onSaveAnnotation }: Props) {
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [scale, setScale] = useState(1.0)
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

        if (tool === 'callout') {
            // Instant click for pin
            const text = prompt('Enter annotation text:')
            if (!text) return

            const newItem: OverlayItem = {
                id: uuidv4(),
                type: 'callout',
                points: [coords],
                page: pageNumber,
                text,
                color: 'red'
            }
            onSaveAnnotation?.(newItem)
            setTool('none')
            return
        }

        setCurrentPath([coords])
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (tool === 'none' || currentPath.length === 0) return
        if (tool === 'callout') return // handled in mouse down

        const coords = getNormCoords(e)
        if (tool === 'freehand') {
            setCurrentPath(prev => [...prev, coords])
        } else {
            // For click-drag shapes (arrow, highlight)
            setCurrentPath([currentPath[0], coords])
        }
    }

    const handleMouseUp = () => {
        if (tool === 'none' || currentPath.length === 0) return
        if (tool === 'callout') return

        // For highlight, freehand etc
        let newItem: OverlayItem = {
            id: uuidv4(),
            type: tool,
            points: currentPath,
            page: pageNumber,
            color: tool === 'highlight' ? 'rgba(255, 255, 0, 0.3)' : 'red'
        }

        // Save immediately
        onSaveAnnotation?.(newItem)
        setCurrentPath([])
        // Optional: keep tool active or reset? Let's keep active for drawing
    }

    const renderOverlayItem = (item: OverlayItem) => {
        if (item.page && item.page !== pageNumber) return null

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

            case 'highlight':
                if (item.points.length < 2) return null
                const hStart = denorm(item.points[0])
                const hEnd = denorm(item.points[item.points.length - 1])
                const x = Math.min(hStart.x, hEnd.x)
                const y = Math.min(hStart.y, hEnd.y)
                const width = Math.abs(hEnd.x - hStart.x)
                const height = Math.abs(hEnd.y - hStart.y)
                return <rect key={item.id} x={x} y={y} width={width} height={height} fill={item.color} stroke="none" />

            case 'text':
            case 'callout':
                if (item.points.length === 0) return null
                const p = denorm(item.points[0])
                return (
                    <g key={item.id} transform={`translate(${p.x}, ${p.y})`}>
                        {/* Pin Icon */}
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#dc2626" transform="translate(-12, -24) scale(1)" />
                        <circle cx="0" cy="-15" r="3" fill="white" />
                        {/* Text label */}
                        <text x="15" y="-5" fill="black" fontSize="14" fontWeight="bold" className="drop-shadow-md bg-white">
                            {item.text}
                        </text>
                    </g>
                )

            default: return null
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
            {/* Toolbar */}
            <div className="flex gap-2 p-2 bg-slate-800 border-b border-slate-700 items-center">
                <button onClick={() => setTool('none')} className={`px-3 py-1 text-sm rounded ${tool === 'none' ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}>Select</button>
                <button onClick={() => setTool('callout')} className={`px-3 py-1 text-sm rounded ${tool === 'callout' ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}>Coment Pin</button>
                <button onClick={() => setTool('highlight')} className={`px-3 py-1 text-sm rounded ${tool === 'highlight' ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}>Highlight</button>
                <button onClick={() => setTool('freehand')} className={`px-3 py-1 text-sm rounded ${tool === 'freehand' ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}>Draw</button>

                <div className="flex-1" />
                <span className="text-xs text-slate-400 mr-2">Page {pageNumber}</span>
                <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} className="px-2 py-1 bg-slate-700 rounded disabled:opacity-50" disabled={pageNumber <= 1}>←</button>
                <button onClick={() => setPageNumber(p => p + 1)} className="px-2 py-1 bg-slate-700 rounded ml-1">→</button>
            </div>

            {/* Viewer Area */}
            <div className="flex-1 overflow-auto flex justify-center p-8 relative bg-slate-950">
                <div
                    ref={containerRef}
                    className="relative shadow-2xl bg-white"
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
                        {/* Render existing items passed from parent */}
                        {overlayJson.map((item) => renderOverlayItem(item))}

                        {/* Current drawing path */}
                        {currentPath.length > 0 && tool !== 'callout' && (
                            tool === 'highlight'
                                ? renderOverlayItem({ id: 'temp', type: 'highlight', points: [currentPath[0], currentPath[currentPath.length - 1]], page: pageNumber, color: 'rgba(255, 255, 0, 0.3)' })
                                : renderOverlayItem({ id: 'temp', type: tool as any, points: currentPath, page: pageNumber, color: 'rgba(255, 0, 0, 0.5)' })
                        )}
                    </svg>
                </div>
            </div>
        </div>
    )
}
