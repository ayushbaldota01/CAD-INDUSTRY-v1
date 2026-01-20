'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuidv4 } from 'uuid'

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export type OverlayItem = {
    id: string
    type: 'callout' | 'text' | 'arrow' | 'freehand' | 'dimension' | 'highlight' | 'comment' | 'issue'
    points: { x: number; y: number }[] // Normalized 0..1
    page?: number
    text?: string
    color?: string
}

type Props = {
    pdfUrl: string
    overlayJson?: OverlayItem[]
    onSaveAnnotation?: (item: OverlayItem) => Promise<OverlayItem | null> | void
    onDeleteAnnotation?: (id: string) => void
    onSaveOverlay?: (items: OverlayItem[]) => void
}

type HistoryAction = {
    type: 'add'
    item: OverlayItem
}

export default function PdfAnnotator({ pdfUrl, overlayJson = [], onSaveAnnotation, onDeleteAnnotation }: Props) {
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [pageNumber, setPageNumber] = useState(1)

    // Dynamic scale for fit-to-screen
    const [scale, setScale] = useState(1)

    const [tool, setTool] = useState<OverlayItem['type'] | 'none'>('none')
    const [highlightColor, setHighlightColor] = useState('#FFEB3B') // Default Yellow
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([])

    // Interaction State
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [hoveredId, setHoveredId] = useState<string | null>(null)

    // History
    const [history, setHistory] = useState<HistoryAction[]>([])
    const [redoStack, setRedoStack] = useState<HistoryAction[]>([])

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    const [viewportDims, setViewportDims] = useState({ width: 800, height: 600 })
    const [isRendering, setIsRendering] = useState(false)
    const renderTaskRef = useRef<any>(null)

    // Load PDF and get initial dimensions
    useEffect(() => {
        const loadPdf = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument(pdfUrl)
                const doc = await loadingTask.promise
                setPdf(doc)
                setNumPages(doc.numPages)

                // Pre-calculate initial viewport dimensions for page 1
                const page = await doc.getPage(1)
                const viewport = page.getViewport({ scale: 1, rotation: 0 })

                // Set initial dimensions based on container
                const container = scrollContainerRef.current
                if (container) {
                    const availableWidth = container.clientWidth - 80
                    const availableHeight = container.clientHeight - 80
                    const scaleX = availableWidth / viewport.width
                    const scaleY = availableHeight / viewport.height
                    const fitScale = Math.max(0.5, Math.min(scaleX, scaleY, 2))

                    setScale(fitScale)
                    setViewportDims({
                        width: viewport.width * fitScale,
                        height: viewport.height * fitScale
                    })
                }
            } catch (err) {
                console.error('Error loading PDF:', err)
            }
        }
        if (pdfUrl) loadPdf()
    }, [pdfUrl])

    // ========== FIT-TO-SCREEN: Calculate optimal scale and viewport dims ==========
    useEffect(() => {
        if (!pdf || !scrollContainerRef.current) return

        const calculateFitScale = async () => {
            try {
                const page = await pdf.getPage(pageNumber)
                // Get the natural dimensions at scale 1 with consistent rotation
                const viewport = page.getViewport({ scale: 1, rotation: 0 })

                const container = scrollContainerRef.current
                if (!container) return

                // Available space (with padding)
                const availableWidth = container.clientWidth - 80  // 40px padding each side
                const availableHeight = container.clientHeight - 80

                // Guard against zero/negative dimensions
                if (availableWidth <= 0 || availableHeight <= 0) return

                // Calculate scale to fit both dimensions
                const scaleX = availableWidth / viewport.width
                const scaleY = availableHeight / viewport.height

                // Use the smaller scale to ensure it fits, cap at 2x max
                const fitScale = Math.max(0.5, Math.min(scaleX, scaleY, 2))

                // Update both scale and viewport dims atomically
                setScale(fitScale)
                setViewportDims({
                    width: viewport.width * fitScale,
                    height: viewport.height * fitScale
                })
            } catch (e) {
                console.error('Error calculating fit scale:', e)
            }
        }

        // Debounce resize calculations
        let resizeTimeout: NodeJS.Timeout
        const handleResize = () => {
            clearTimeout(resizeTimeout)
            resizeTimeout = setTimeout(calculateFitScale, 100)
        }

        calculateFitScale()

        // Recalculate on resize
        const resizeObserver = new ResizeObserver(handleResize)

        if (scrollContainerRef.current) {
            resizeObserver.observe(scrollContainerRef.current)
        }

        return () => {
            clearTimeout(resizeTimeout)
            resizeObserver.disconnect()
        }
    }, [pdf, pageNumber])
    // =============================================================

    // Render Page with proper cancellation and high DPI support
    useEffect(() => {
        if (!pdf || !canvasRef.current || pageNumber > pdf.numPages || pageNumber < 1) return

        // Cancel any previous render task
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel()
            renderTaskRef.current = null
        }

        setIsRendering(true)
        let isCancelled = false

        const renderPage = async () => {
            try {
                const page = await pdf.getPage(pageNumber)
                if (isCancelled) return

                // Use explicit rotation: 0 to ensure consistent orientation
                const viewport = page.getViewport({ scale, rotation: 0 })
                const canvas = canvasRef.current
                if (!canvas || isCancelled) return

                // Set container dimensions FIRST (before rendering)
                const newDims = { width: viewport.width, height: viewport.height }
                setViewportDims(newDims)

                // High DPI support for crisp rendering
                const dpr = Math.min(window.devicePixelRatio || 1, 2)
                canvas.width = viewport.width * dpr
                canvas.height = viewport.height * dpr
                canvas.style.width = `${viewport.width}px`
                canvas.style.height = `${viewport.height}px`

                const context = canvas.getContext('2d')
                if (!context || isCancelled) return

                context.scale(dpr, dpr)

                // Store render task for potential cancellation
                const renderTask = page.render({ canvasContext: context, viewport })
                renderTaskRef.current = renderTask

                await renderTask.promise
                setIsRendering(false)
            } catch (e: any) {
                // Only log non-cancellation errors
                if (e?.name !== 'RenderingCancelledException') {
                    console.error('PDF render error:', e)
                }
                setIsRendering(false)
            }
        }

        renderPage()

        return () => {
            isCancelled = true
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel()
                renderTaskRef.current = null
            }
        }
    }, [pdf, pageNumber, scale])

    // -------------------------------------------------------------------------
    // COORDINATE HANDLING - Use viewportDims for accurate normalization
    // -------------------------------------------------------------------------
    const getNormCoords = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current || viewportDims.width === 0 || viewportDims.height === 0) {
            return { x: 0, y: 0 }
        }

        const rect = containerRef.current.getBoundingClientRect()
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top

        // Use viewportDims for normalization to ensure consistency with rendered canvas
        let x = px / viewportDims.width
        let y = py / viewportDims.height

        // Clamp to valid range
        x = Math.max(0, Math.min(1, x))
        y = Math.max(0, Math.min(1, y))

        return { x, y }
    }, [viewportDims])

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return

        if (tool === 'none') {
            if (e.target === containerRef.current || e.target === canvasRef.current) {
                setSelectedId(null)
            }
            return
        }

        const coords = getNormCoords(e)

        if (tool === 'comment' || tool === 'issue') {
            const text = prompt(`Enter ${tool === 'issue' ? 'Issue' : 'Comment'} text:`)
            if (!text) {
                setTool('none')
                return
            }

            const isIssue = tool === 'issue'
            const newItem: OverlayItem = {
                id: uuidv4(),
                type: isIssue ? 'issue' : 'comment',
                points: [coords],
                page: pageNumber,
                text: text,
                color: isIssue ? '#ef4444' : '#3b82f6'
            }

                ; (async () => {
                    const saved = await onSaveAnnotation?.(newItem) as OverlayItem | undefined
                    if (saved) {
                        setHistory(prev => [...prev, { type: 'add', item: saved }])
                    }
                })()

            setTool('none')
            return
        }

        setCurrentPath([coords])
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (tool === 'none' || currentPath.length === 0) return
        if (tool === 'comment' || tool === 'issue') return

        const coords = getNormCoords(e)
        if (tool === 'freehand') {
            const last = currentPath[currentPath.length - 1]
            const dist = Math.sqrt(Math.pow(coords.x - last.x, 2) + Math.pow(coords.y - last.y, 2))
            if (dist > 0.001) {
                setCurrentPath(prev => [...prev, coords])
            }
        } else {
            setCurrentPath([currentPath[0], coords])
        }
    }

    const handleMouseUp = () => {
        if (tool === 'none' || currentPath.length === 0) return
        if (tool === 'comment' || tool === 'issue') return

        const newItem: OverlayItem = {
            id: uuidv4(),
            type: tool,
            points: currentPath,
            page: pageNumber,
            color: tool === 'highlight' ? highlightColor : '#ef4444'
        }

            ; (async () => {
                const saved = await onSaveAnnotation?.(newItem) as OverlayItem | undefined
                if (saved) {
                    setHistory(prev => [...prev, { type: 'add', item: saved }])
                }
            })()

        setCurrentPath([])
    }

    const handleUndo = useCallback(() => {
        if (history.length === 0) return
        const lastAction = history[history.length - 1]
        setHistory(h => h.slice(0, -1))
        if (lastAction.type === 'add') {
            onDeleteAnnotation?.(lastAction.item.id)
            setRedoStack(r => [...r, lastAction])
        }
    }, [history, onDeleteAnnotation])

    const handleRedo = useCallback(async () => {
        if (redoStack.length === 0) return
        const action = redoStack[redoStack.length - 1]
        setRedoStack(r => r.slice(0, -1))
        if (action.type === 'add') {
            const saved = await onSaveAnnotation?.(action.item)
            if (saved) setHistory(h => [...h, { type: 'add', item: saved }])
        }
    }, [redoStack, onSaveAnnotation])


    const renderOverlayItem = (item: OverlayItem, index: number) => {
        if (item.page && item.page !== pageNumber) return null

        const w = viewportDims.width
        const h = viewportDims.height
        const denorm = (p: { x: number, y: number }) => ({ x: p.x * w, y: p.y * h })

        const isHovered = hoveredId === item.id
        const isSelected = selectedId === item.id

        const isPin = item.type === 'callout' || item.type === 'comment' || item.type === 'issue'
        const opacity = (tool === 'none' && !isHovered && !isSelected && isPin) ? 0.8 : 1.0

        // Determine Color based on Type or explicit color
        let pinColor = item.color || '#3b82f6'
        if (item.type === 'issue') pinColor = '#ef4444'
        if (item.type === 'comment') pinColor = '#3b82f6'
        // Legacy Support
        if (item.text?.includes('[ISSUE]')) pinColor = '#ef4444'

        const commonProps = {
            onMouseEnter: () => setHoveredId(item.id),
            onMouseLeave: () => setHoveredId(null),
            onClick: (e: React.MouseEvent) => {
                e.preventDefault()
                e.stopPropagation()
                setSelectedId(prev => prev === item.id ? null : item.id)
            },
            style: { cursor: tool === 'none' ? 'pointer' : 'default' }
        }

        switch (item.type) {
            case 'freehand':
                const pathData = item.points.map((p, i) => {
                    const dp = denorm(p)
                    return `${i === 0 ? 'M' : 'L'} ${dp.x} ${dp.y}`
                }).join(' ')
                return <path key={item.id} d={pathData} stroke={item.color} strokeWidth="3" fill="none" strokeLinecap="round" {...commonProps} />

            case 'arrow':
                if (item.points.length < 2) return null
                const s = denorm(item.points[0])
                const e = denorm(item.points[item.points.length - 1])
                return <line key={item.id} x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={item.color} strokeWidth="3" markerEnd="url(#arrowhead)" {...commonProps} />

            case 'highlight':
                if (item.points.length < 2) return null
                const p1 = denorm(item.points[0])
                const p2 = denorm(item.points[item.points.length - 1])
                return <rect key={item.id} x={Math.min(p1.x, p2.x)} y={Math.min(p1.y, p2.y)} width={Math.abs(p2.x - p1.x)} height={Math.abs(p2.y - p1.y)} fill={item.color} fillOpacity="0.4" {...commonProps} />

            case 'text':
            case 'callout':
            case 'comment':
            case 'issue':
                if (item.points.length === 0) return null
                const p = denorm(item.points[0])
                return (
                    <g key={item.id} transform={`translate(${p.x}, ${p.y})`} opacity={opacity} {...commonProps}>
                        {/* Target Area */}
                        <circle cx="0" cy="-20" r="25" fill="transparent" />
                        {/* Stick */}
                        <line x1="0" y1="0" x2="0" y2="-40" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                        {/* Bubble */}
                        <circle cx="0" cy="-40" r={isSelected ? 18 : 15} fill={isSelected ? '#1e293b' : pinColor} stroke="white" strokeWidth="2" className="transition-all duration-200" />
                        {/* Index */}
                        <text x="0" y="-35" textAnchor="middle" fill="white" fontSize={12} fontWeight="bold" className="pointer-events-none">{index + 1}</text>
                        {/* Anchor Dot */}
                        <circle cx="0" cy="0" r="3" fill="#10b981" stroke="white" strokeWidth="1" />
                    </g>
                )
            default: return null
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white relative">
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-hidden bg-slate-950 relative"
            >
                {/* Wrapper centers the PDF canvas */}
                <div ref={wrapperRef} className="w-full h-full flex items-center justify-center p-4 relative">
                    <div
                        ref={containerRef}
                        className="relative shadow-2xl bg-white origin-center"
                        style={{
                            width: viewportDims.width,
                            height: viewportDims.height,
                            cursor: tool !== 'none' ? 'crosshair' : 'default'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    >
                        <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 pointer-events-none"
                            style={{ width: viewportDims.width, height: viewportDims.height }}
                        />
                        {/* Loading overlay */}
                        {isRendering && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        )}
                        <svg className="absolute top-0 left-0 pointer-events-auto" width={viewportDims.width} height={viewportDims.height} viewBox={`0 0 ${viewportDims.width} ${viewportDims.height}`}>
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                                </marker>
                            </defs>
                            {overlayJson.map((item, idx) => renderOverlayItem(item, idx))}

                            {currentPath.length > 0 && tool !== 'none' && (
                                <g opacity={0.6}>
                                    {tool === 'highlight'
                                        ? <rect
                                            x={Math.min(currentPath[0].x, currentPath[currentPath.length - 1].x) * viewportDims.width}
                                            y={Math.min(currentPath[0].y, currentPath[currentPath.length - 1].y) * viewportDims.height}
                                            width={Math.abs(currentPath[currentPath.length - 1].x - currentPath[0].x) * viewportDims.width}
                                            height={Math.abs(currentPath[currentPath.length - 1].y - currentPath[0].y) * viewportDims.height}
                                            fill={highlightColor} />
                                        : <path d={`M ${currentPath.map(p => `${p.x * viewportDims.width} ${p.y * viewportDims.height}`).join(' L ')}`} stroke="#ef4444" strokeWidth="3" fill="none" />
                                    }
                                </g>
                            )}
                        </svg>
                    </div>
                </div>
            </div>

            {/* FIXED POPUP OVERLAY */}
            {selectedId && overlayJson.find(i => i.id === selectedId) && (
                <div className="fixed inset-0 pointer-events-none z-[9999]">
                    {(() => {
                        const item = overlayJson.find(i => i.id === selectedId)!
                        if (!['callout', 'comment', 'issue'].includes(item.type)) return null
                        if (!containerRef.current) return null

                        // Use getBoundingClientRect for bulletproof absolute positioning
                        const rect = containerRef.current.getBoundingClientRect()
                        const itemX = rect.left + (item.points[0].x * rect.width)
                        const itemY = rect.top + (item.points[0].y * rect.height)

                        // Logic to check title/color
                        const isIssue = item.type === 'issue' || item.color === '#ef4444' || item.text?.includes('[ISSUE]')

                        return (
                            <div
                                className="absolute pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
                                style={{
                                    left: itemX,
                                    top: itemY - 60, // Position above the pin head
                                    transform: 'translate(-50%, -100%)'
                                }}
                            >
                                <div className="bg-slate-900/95 backdrop-blur text-white p-4 rounded-xl shadow-2xl border border-slate-700/50 min-w-[240px] max-w-sm relative">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700/50">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isIssue ? 'text-red-400' : 'text-blue-400'}`}>
                                            {isIssue ? 'Critical Issue' : 'Comment'}
                                        </span>
                                        <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-white transition-colors">✕</button>
                                    </div>
                                    <p className="leading-relaxed text-sm text-slate-300 font-medium">
                                        {item.text?.replace('[ISSUE]', '').trim()}
                                    </p>

                                    {/* Arrow */}
                                    <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 bg-slate-900/95 border-r border-b border-slate-700/50 rotate-45" />
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* Toolbar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-[100]">
                {tool === 'highlight' && (
                    <div className="flex gap-2 p-1.5 bg-slate-900/90 backdrop-blur rounded-full border border-slate-700 shadow-xl">
                        {['#FFEB3B', '#4CAF50', '#2196F3', '#FF9800'].map(c => (
                            <button key={c} onClick={() => setHighlightColor(c)} className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition" style={{ background: c }} />
                        ))}
                    </div>
                )}

                {/* Page Navigation */}
                {numPages > 1 && (
                    <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl ring-1 ring-white/10">
                        <button
                            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                            disabled={pageNumber <= 1}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${pageNumber <= 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                        >
                            ← Prev
                        </button>
                        <span className="text-sm font-mono text-slate-300 min-w-[60px] text-center">
                            {pageNumber} / {numPages}
                        </span>
                        <button
                            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                            disabled={pageNumber >= numPages}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${pageNumber >= numPages ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                        >
                            Next →
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-1 p-1.5 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl ring-1 ring-white/10">
                    <ToolBtn active={tool === 'none'} onClick={() => setTool('none')} icon={<CursorIcon />} title="Pan" />
                    <div className="w-px h-6 bg-slate-700/50 mx-1" />
                    <ToolBtn active={tool === 'comment'} onClick={() => setTool('comment')} icon={<ChatIcon />} title="Add Comment" color="text-blue-400 hover:bg-blue-500/10" />
                    <ToolBtn active={tool === 'issue'} onClick={() => setTool('issue')} icon={<AlertIcon />} title="Flag Issue" color="text-red-400 hover:bg-red-500/10" />
                    <div className="w-px h-6 bg-slate-700/50 mx-1" />
                    <ToolBtn active={tool === 'highlight'} onClick={() => setTool('highlight')} icon={<HighlightIcon />} title="Highlight Area" />
                    <ToolBtn active={tool === 'freehand'} onClick={() => setTool('freehand')} icon={<PencilIcon />} title="Draw" />
                    <div className="w-px h-6 bg-slate-700/50 mx-1" />
                    <ToolBtn onClick={handleUndo} disabled={history.length === 0} icon={<UndoIcon />} title="Undo" />
                    <ToolBtn onClick={handleRedo} disabled={redoStack.length === 0} icon={<RedoIcon />} title="Redo" />
                </div>
            </div>
        </div>
    )
}

const ToolBtn = ({ active, onClick, icon, disabled, title, color }: any) => (
    <button onClick={onClick} disabled={disabled} title={title} className={`p-2.5 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center ${active ? 'bg-slate-800 text-white shadow-inner ring-1 ring-white/10' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${active && color ? color : ''}`}>
        {icon}
    </button>
)

const CursorIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
const ChatIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
const AlertIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
const HighlightIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
const PencilIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
const UndoIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
const RedoIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l6 6m6-6l-6-6" /></svg>
