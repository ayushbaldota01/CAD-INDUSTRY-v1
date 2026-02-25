'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { v4 as uuidv4 } from 'uuid'
import type { PDFOverlayItem } from '@/types'

// Re-export for backward compatibility with existing imports
export type OverlayItem = PDFOverlayItem

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

type Props = {
    pdfUrl: string
    overlayJson?: PDFOverlayItem[]
    onSaveAnnotation?: (item: PDFOverlayItem) => Promise<PDFOverlayItem | null> | void
    onDeleteAnnotation?: (id: string) => void
    onSaveOverlay?: (items: PDFOverlayItem[]) => void
    onPdfLoadError?: () => void
    onUpdateLeader?: (id: string, leaderOffset: { x: number; y: number }) => void
}

type HistoryAction = {
    type: 'add'
    item: PDFOverlayItem
}

export default function PdfAnnotator({ pdfUrl, overlayJson = [], onSaveAnnotation, onDeleteAnnotation, onUpdateLeader }: Props) {
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

    // Measurement & Calibration
    const [calibrationScale, setCalibrationScale] = useState<number | null>(null) // pixels per mm
    const [isCalibrating, setIsCalibrating] = useState(false)
    const [measurementUnit, setMeasurementUnit] = useState<'mm' | 'cm' | 'in' | 'ft'>('mm')
    const [loadingProgress, setLoadingProgress] = useState(0)
    const [toast, setToast] = useState<string | null>(null)

    // Inline balloon input dialog (replaces native prompt)
    const [pendingBalloon, setPendingBalloon] = useState<{
        coords: { x: number; y: number }
        type: 'comment' | 'issue'
        text: string
        screenX: number  // pixel position on screen for floating panel
        screenY: number
    } | null>(null)
    const balloonInputRef = useRef<HTMLTextAreaElement>(null)

    // Zoom & Pan
    const [zoomLevel, setZoomLevel] = useState(1)
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
    const [isPanning, setIsPanning] = useState(false)
    const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
    const [showZoomIndicator, setShowZoomIndicator] = useState(false)
    const zoomTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Inline calibration panel (replaces window.prompt)
    const [pendingCalibration, setPendingCalibration] = useState<{
        p1: { x: number; y: number }
        p2: { x: number; y: number }
        pixelDistance: number
        inputMm: string
    } | null>(null)

    // Dragging leader line
    const [draggingLeaderId, setDraggingLeaderId] = useState<string | null>(null)
    const leaderDragStartRef = useRef<{ mouseX: number; mouseY: number; origOffset: { x: number; y: number } } | null>(null)
    const draggingLeaderOffsetRef = useRef<{ x: number; y: number } | null>(null)
    const [draggingLeaderPreview, setDraggingLeaderPreview] = useState<{ id: string; offset: { x: number; y: number } } | null>(null)

    // PDF load error
    const [pdfError, setPdfError] = useState<string | null>(null)

    const showToast = useCallback((msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }, [])

    /** Called when the user confirms the inline balloon text input */
    const confirmBalloon = useCallback(async () => {
        if (!pendingBalloon) return
        const { coords, type, text } = pendingBalloon
        if (!text.trim()) {
            setPendingBalloon(null)
            return
        }
        const newItem: PDFOverlayItem = {
            id: uuidv4(),
            type,
            points: [coords],
            x: coords.x,
            y: coords.y,
            page: pageNumber,
            text: text.trim(),
            color: type === 'issue' ? '#ef4444' : '#3b82f6',
            leaderOffset: { x: 0.04, y: -0.04 },
        }
        setPendingBalloon(null)
        setTool('none')
        const saved = await onSaveAnnotation?.(newItem) as OverlayItem | undefined
        if (saved) {
            setHistory(prev => [...prev, { type: 'add', item: saved }])
        }
    }, [pendingBalloon, pageNumber, onSaveAnnotation])

    // Load PDF with optimized settings
    useEffect(() => {
        if (!pdfUrl) return

        let cancelled = false

        const loadPdf = async () => {
            try {
                setLoadingProgress(10)

                // Use range requests and disable stream for faster initial load
                const loadingTask = pdfjsLib.getDocument({
                    url: pdfUrl,
                    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
                    cMapPacked: true,
                    disableStream: false,
                    disableAutoFetch: false,
                })

                loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
                    if (progress.total > 0) {
                        setLoadingProgress(Math.min(90, Math.round((progress.loaded / progress.total) * 80) + 10))
                    }
                }

                const doc = await loadingTask.promise
                if (cancelled) return

                setPdf(doc)
                setNumPages(doc.numPages)
                setLoadingProgress(95)

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

                setLoadingProgress(100)
            } catch (err) {
                console.error('Error loading PDF:', err)
                setLoadingProgress(0)
            }
        }

        loadPdf()

        return () => {
            cancelled = true
        }
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
    // BUG 1 FIX: Use rect.width/height (which include CSS scale from zoom)
    // instead of viewportDims (unscaled canvas size). This makes annotation
    // placement correct at any zoom level.
    const getNormCoords = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 }
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        return { x, y }
    }, [])

    // BUG 5 FIX: tool==='none' + left-drag on empty canvas starts pan
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return

        if (tool === 'none') {
            if (e.target === containerRef.current || e.target === canvasRef.current) {
                setSelectedId(null)
                // Start panning on left-drag over empty area
                setIsPanning(true)
                panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y }
            }
            return
        }

        const coords = getNormCoords(e)

        if (tool === 'comment' || tool === 'issue') {
            // Get screen position for the floating input panel
            const rect = containerRef.current?.getBoundingClientRect()
            const screenX = rect ? (e.clientX - rect.left) : e.clientX
            const screenY = rect ? (e.clientY - rect.top) : e.clientY
            setPendingBalloon({ coords, type: tool, text: '', screenX, screenY })
            // Focus input after next render
            setTimeout(() => balloonInputRef.current?.focus(), 50)
            return
        }

        // Click-to-place for dimension and calibration
        if (tool === 'dimension' || isCalibrating) {
            if (currentPath.length === 0) {
                // First click - set start point
                setCurrentPath([coords])
            } else {
                // Second click - complete measurement
                const p1 = currentPath[0]
                const p2 = coords

                // Calculate pixel distance
                const dx = (p2.x - p1.x) * viewportDims.width
                const dy = (p2.y - p1.y) * viewportDims.height
                const pixelDistance = Math.sqrt(dx * dx + dy * dy)

                if (isCalibrating) {
                    // Show inline calibration panel instead of window.prompt()
                    setPendingCalibration({
                        p1, p2,
                        pixelDistance,
                        inputMm: '',
                    })
                    setIsCalibrating(false)
                } else if (tool === 'dimension') {
                    if (!calibrationScale) {
                        showToast('Please calibrate first! Use the Calibrate tool to set a known distance.')
                        setCurrentPath([])
                        return
                    }

                    const distanceMm = pixelDistance / calibrationScale

                    const newItem: PDFOverlayItem = {
                        id: uuidv4(),
                        type: 'dimension',
                        points: [p1, p2],
                        x: p1.x,
                        y: p1.y,
                        page: pageNumber,
                        color: '#facc15',
                        distance: distanceMm,
                        unit: measurementUnit
                    }

                        ; (async () => {
                            const saved = await onSaveAnnotation?.(newItem) as OverlayItem | undefined
                            if (saved) {
                                setHistory(prev => [...prev, { type: 'add', item: saved }])
                            }
                        })()
                }

                setCurrentPath([])
            }
            return
        }

        setCurrentPath([coords])
    }

    // Track mouse position for dimension preview
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

    const handleMouseMove = (e: React.MouseEvent) => {
        // BUG 6: Leader drag — handle BEFORE early returns
        if (draggingLeaderId && leaderDragStartRef.current) {
            const start = leaderDragStartRef.current
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) {
                const dxPx = e.clientX - start.mouseX
                const dyPx = e.clientY - start.mouseY
                const dxNorm = dxPx / rect.width
                const dyNorm = dyPx / rect.height
                let newX = start.origOffset.x + dxNorm
                let newY = start.origOffset.y + dyNorm
                // Clamp leader length max 150px in normalized space
                const lenPx = Math.sqrt(
                    Math.pow(newX * rect.width, 2) + Math.pow(newY * rect.height, 2)
                )
                if (lenPx > 150) {
                    const clamp = 150 / lenPx
                    newX *= clamp
                    newY *= clamp
                }
                draggingLeaderOffsetRef.current = { x: newX, y: newY }
                setDraggingLeaderPreview({ id: draggingLeaderId, offset: { x: newX, y: newY } })
            }
            return
        }

        const coords = getNormCoords(e)

        // Always track hover for dimension/calibration preview
        if ((tool === 'dimension' || isCalibrating) && currentPath.length === 1) {
            setHoverPos(coords)
        } else {
            setHoverPos(null)
        }

        if (tool === 'none' || currentPath.length === 0) return
        if (tool === 'comment' || tool === 'issue') return
        if (tool === 'dimension' || isCalibrating) return // Don't drag for these

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
        // BUG 6: Commit leader drag
        if (draggingLeaderId && draggingLeaderOffsetRef.current) {
            onUpdateLeader?.(draggingLeaderId, draggingLeaderOffsetRef.current)
            setDraggingLeaderId(null)
            setDraggingLeaderPreview(null)
            draggingLeaderOffsetRef.current = null
            leaderDragStartRef.current = null
            return
        }

        // BUG 5: End pan on mouse up (isPanning is reset by handlePanEnd on scrollContainer)
        if (tool === 'none' || currentPath.length === 0) return
        if (tool === 'comment' || tool === 'issue') return
        if (tool === 'dimension' || isCalibrating) return // Handled by click-to-place

        const newItem: PDFOverlayItem = {
            id: uuidv4(),
            type: tool,
            points: currentPath,
            x: currentPath[0].x,
            y: currentPath[0].y,
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

            case 'dimension':
                if (item.points.length < 2 || !item.distance) return null
                const dimStart = denorm(item.points[0])
                const dimEnd = denorm(item.points[item.points.length - 1])
                const midX = (dimStart.x + dimEnd.x) / 2
                const midY = (dimStart.y + dimEnd.y) / 2

                // Convert distance to selected unit
                const convertDistance = (mm: number, unit: string) => {
                    switch (unit) {
                        case 'cm': return (mm / 10).toFixed(2)
                        case 'in': return (mm / 25.4).toFixed(2)
                        case 'ft': return (mm / 304.8).toFixed(3)
                        default: return mm.toFixed(1)
                    }
                }

                const displayDist = convertDistance(item.distance, item.unit || measurementUnit)
                const displayUnit = item.unit || measurementUnit
                const dimHovered = hoveredId === item.id
                const dimOpacity = dimHovered ? 1 : 0.25

                // Calculate line angle for better hit detection
                const lineLength = Math.sqrt(
                    Math.pow(dimEnd.x - dimStart.x, 2) + Math.pow(dimEnd.y - dimStart.y, 2)
                )

                return (
                    <g
                        key={item.id}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredId(item.id)}
                        onMouseLeave={() => setHoveredId(null)}
                    >
                        {/* Invisible wider hit area for easier hovering */}
                        <line
                            x1={dimStart.x}
                            y1={dimStart.y}
                            x2={dimEnd.x}
                            y2={dimEnd.y}
                            stroke="transparent"
                            strokeWidth="20"
                        />

                        {/* Visible dimension line */}
                        <line
                            x1={dimStart.x}
                            y1={dimStart.y}
                            x2={dimEnd.x}
                            y2={dimEnd.y}
                            stroke="#facc15"
                            strokeWidth={dimHovered ? 3 : 1.5}
                            opacity={dimOpacity}
                            style={{ transition: 'all 0.2s ease' }}
                        />

                        {/* End markers - always somewhat visible */}
                        <circle
                            cx={dimStart.x}
                            cy={dimStart.y}
                            r={dimHovered ? 6 : 3}
                            fill="#facc15"
                            stroke="white"
                            strokeWidth={dimHovered ? 2 : 1}
                            opacity={dimHovered ? 1 : 0.4}
                            style={{ transition: 'all 0.2s ease' }}
                        />
                        <circle
                            cx={dimEnd.x}
                            cy={dimEnd.y}
                            r={dimHovered ? 6 : 3}
                            fill="#facc15"
                            stroke="white"
                            strokeWidth={dimHovered ? 2 : 1}
                            opacity={dimHovered ? 1 : 0.4}
                            style={{ transition: 'all 0.2s ease' }}
                        />

                        {/* Measurement label - only visible on hover */}
                        <g
                            transform={`translate(${midX}, ${midY})`}
                            opacity={dimHovered ? 1 : 0}
                            style={{ transition: 'opacity 0.2s ease', pointerEvents: 'none' }}
                        >
                            <rect
                                x={-Math.max(35, lineLength * 0.1)}
                                y="-14"
                                width={Math.max(70, lineLength * 0.2)}
                                height="28"
                                fill="#1e293b"
                                rx="6"
                                stroke="#facc15"
                                strokeWidth="2"
                            />
                            <text
                                x="0"
                                y="5"
                                textAnchor="middle"
                                fill="#facc15"
                                fontSize="13"
                                fontWeight="bold"
                            >
                                {displayDist} {displayUnit}
                            </text>
                        </g>
                    </g>
                )

            case 'text':
            case 'callout':
            case 'comment':
            case 'issue':
                if (item.points.length === 0) return null
                const p = denorm(item.points[0])

                // Engineering Balloon Style
                // BUG 6: Use live preview offset during drag, otherwise item data
                const leaderOff = (draggingLeaderPreview?.id === item.id)
                    ? draggingLeaderPreview.offset
                    : (item.leaderOffset || { x: 0.04, y: -0.04 })
                let lx = leaderOff.x * w
                let ly = leaderOff.y * h

                // Clamp leader length to max 150px
                const leaderLen = Math.sqrt(lx * lx + ly * ly)
                if (leaderLen > 150) {
                    const clampRatio = 150 / leaderLen
                    lx *= clampRatio
                    ly *= clampRatio
                }

                const r = 14 // Balloon radius

                // Calculate line end point (at circle boundary)
                const angle = Math.atan2(ly, lx)
                const lineEndX = lx - (r * Math.cos(angle))
                const lineEndY = ly - (r * Math.sin(angle))

                // Balloon Number: ALWAYS use item.balloonNo — never index fallback
                const hasBalloonNo = item.balloonNo != null
                const balloonNum = hasBalloonNo ? item.balloonNo : '?'
                const balloonMissing = !hasBalloonNo

                const isIssue = item.type === 'issue' || item.color === '#ef4444'

                return (
                    <g key={item.id} transform={`translate(${p.x}, ${p.y})`} opacity={opacity} {...commonProps}>
                        {/* Hit Area for easier selection */}
                        <circle cx={lx} cy={ly} r={r + 10} fill="transparent" />

                        {/* Anchor Dot */}
                        <circle cx="0" cy="0" r="2.5" fill={pinColor} />

                        {/* Leader Line */}
                        <line
                            x1="0"
                            y1="0"
                            x2={lineEndX}
                            y2={lineEndY}
                            stroke={pinColor}
                            strokeWidth="1.5"
                        />

                        {/* Balloon Circle */}
                        <circle
                            cx={lx}
                            cy={ly}
                            r={r}
                            fill={isSelected ? '#1e293b' : 'white'}
                            stroke={balloonMissing ? '#ef4444' : pinColor}
                            strokeWidth={balloonMissing ? 3 : 2}
                            className="transition-all duration-200 shadow-sm"
                            style={{ cursor: tool === 'none' ? 'move' : 'default' }}
                        />

                        {/* Red error ring for missing balloon number */}
                        {balloonMissing && (
                            <circle cx={lx} cy={ly} r={r + 3} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2" />
                        )}

                        {/* Balloon Number */}
                        <text
                            x={lx}
                            y={ly}
                            dy="4"
                            textAnchor="middle"
                            fill={balloonMissing ? '#ef4444' : (isSelected ? 'white' : pinColor)}
                            fontSize={12}
                            fontWeight="bold"
                            className="pointer-events-none select-none font-mono"
                        >
                            {balloonNum}
                        </text>

                        {/* Issue indicator */}
                        {isIssue && (
                            <circle cx={lx + r - 2} cy={ly - r + 2} r="4" fill="#ef4444" stroke="white" strokeWidth="1" />
                        )}

                        {/* BUG 6: Drag handle for leader repositioning — wired to drag logic */}
                        {isSelected && tool === 'none' && (
                            <circle
                                cx={lx} cy={ly} r={4}
                                fill={pinColor} stroke="white" strokeWidth="1.5"
                                style={{ cursor: 'move' }}
                                onMouseDown={(ev) => {
                                    ev.stopPropagation()
                                    ev.preventDefault()
                                    setDraggingLeaderId(item.id)
                                    leaderDragStartRef.current = {
                                        mouseX: ev.clientX,
                                        mouseY: ev.clientY,
                                        origOffset: item.leaderOffset || { x: 0.04, y: -0.04 },
                                    }
                                }}
                            />
                        )}
                    </g>
                )
            default: return null
        }
    }

    // ─── Zoom & Pan Handlers ────────────────────────────────────────
    // BUG 4 FIX: Zoom towards cursor position
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault()
        if (!scrollContainerRef.current) return

        const rect = scrollContainerRef.current.getBoundingClientRect()
        // Cursor position relative to container center (where transformOrigin is)
        const cursorX = e.clientX - rect.left - rect.width / 2
        const cursorY = e.clientY - rect.top - rect.height / 2

        const factor = e.deltaY < 0 ? 1.1 : 0.9

        setZoomLevel(prev => {
            const next = Math.min(5, Math.max(0.25, prev * factor))
            const ratio = next / prev
            // Shift pan offset so the point under cursor stays fixed
            setPanOffset(p => ({
                x: cursorX - (cursorX - p.x) * ratio,
                y: cursorY - (cursorY - p.y) * ratio,
            }))
            setShowZoomIndicator(true)
            if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current)
            zoomTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1500)
            return next
        })
    }, [])

    // BUG 5 FIX: Middle mouse always pans; removed altKey requirement
    const handlePanStart = useCallback((e: React.MouseEvent) => {
        if (e.button === 1) {
            e.preventDefault()
            setIsPanning(true)
            panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y }
        }
    }, [panOffset])

    const handlePanMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        setPanOffset({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy })
    }, [isPanning])

    const handlePanEnd = useCallback(() => {
        setIsPanning(false)
    }, [])

    const resetView = useCallback(() => {
        setZoomLevel(1)
        setPanOffset({ x: 0, y: 0 })
    }, [])

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white relative">
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-hidden bg-slate-950 relative"
                onWheel={handleWheel}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
            >
                {/* Zoom indicator */}
                {showZoomIndicator && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white px-4 py-1.5 rounded-full text-sm font-mono backdrop-blur-sm border border-white/10 pointer-events-none animate-pulse">
                        {Math.round(zoomLevel * 100)}%
                    </div>
                )}

                {/* Reset view button (shown when zoomed/panned) */}
                {(zoomLevel !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
                    <button
                        onClick={resetView}
                        className="absolute bottom-4 right-4 z-40 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs border border-slate-600 transition-colors"
                    >
                        ⟲ Reset View
                    </button>
                )}

                {/* Wrapper centers the PDF canvas, applies zoom/pan transform */}
                <div ref={wrapperRef} className="w-full h-full flex items-center justify-center p-4 relative">
                    <div
                        ref={containerRef}
                        className="relative shadow-2xl bg-white origin-center"
                        style={{
                            width: viewportDims.width,
                            height: viewportDims.height,
                            cursor: isPanning ? 'grabbing' : isCalibrating ? 'crosshair' : tool !== 'none' ? 'crosshair' : 'grab',
                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                            transformOrigin: 'center center',
                            transition: isPanning ? 'none' : 'transform 0.1s ease-out',
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
                        {/* Initial loading overlay with progress */}
                        {loadingProgress > 0 && loadingProgress < 100 && !pdf && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <div className="text-slate-400 text-sm mb-2">Loading PDF...</div>
                                <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-300"
                                        style={{ width: `${loadingProgress}%` }}
                                    />
                                </div>
                                <div className="text-slate-500 text-xs mt-1">{loadingProgress}%</div>
                            </div>
                        )}
                        {/* Page rendering overlay */}
                        {isRendering && pdf && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                <div className="w-6 h-6 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        )}
                        <svg className="absolute top-0 left-0 pointer-events-auto" width={viewportDims.width} height={viewportDims.height} viewBox={`0 0 ${viewportDims.width} ${viewportDims.height}`}>
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                                </marker>
                            </defs>
                            {overlayJson.map((item, idx) => renderOverlayItem(item, idx))}

                            {/* Dimension/Calibration preview line */}
                            {currentPath.length === 1 && hoverPos && (tool === 'dimension' || isCalibrating) && (
                                <g opacity={0.8}>
                                    {/* Preview line */}
                                    <line
                                        x1={currentPath[0].x * viewportDims.width}
                                        y1={currentPath[0].y * viewportDims.height}
                                        x2={hoverPos.x * viewportDims.width}
                                        y2={hoverPos.y * viewportDims.height}
                                        stroke={isCalibrating ? '#22c55e' : '#facc15'}
                                        strokeWidth="2"
                                        strokeDasharray="6,4"
                                    />
                                    {/* Start point */}
                                    <circle
                                        cx={currentPath[0].x * viewportDims.width}
                                        cy={currentPath[0].y * viewportDims.height}
                                        r="6"
                                        fill={isCalibrating ? '#22c55e' : '#facc15'}
                                        stroke="white"
                                        strokeWidth="2"
                                    />
                                    {/* Hover point */}
                                    <circle
                                        cx={hoverPos.x * viewportDims.width}
                                        cy={hoverPos.y * viewportDims.height}
                                        r="5"
                                        fill="none"
                                        stroke={isCalibrating ? '#22c55e' : '#facc15'}
                                        strokeWidth="2"
                                        strokeDasharray="3,2"
                                    />
                                    {/* Live distance label */}
                                    {calibrationScale && !isCalibrating && (
                                        <g transform={`translate(${((currentPath[0].x + hoverPos.x) / 2) * viewportDims.width}, ${((currentPath[0].y + hoverPos.y) / 2) * viewportDims.height - 15})`}>
                                            <rect x="-30" y="-10" width="60" height="20" fill="#1e293b" rx="4" opacity="0.9" />
                                            <text x="0" y="4" textAnchor="middle" fill="#facc15" fontSize="11" fontWeight="bold">
                                                {(() => {
                                                    const dx = (hoverPos.x - currentPath[0].x) * viewportDims.width
                                                    const dy = (hoverPos.y - currentPath[0].y) * viewportDims.height
                                                    const px = Math.sqrt(dx * dx + dy * dy)
                                                    const mm = px / calibrationScale
                                                    return `${mm.toFixed(1)} mm`
                                                })()}
                                            </text>
                                        </g>
                                    )}
                                    {isCalibrating && (
                                        <text
                                            x={((currentPath[0].x + hoverPos.x) / 2) * viewportDims.width}
                                            y={((currentPath[0].y + hoverPos.y) / 2) * viewportDims.height - 12}
                                            textAnchor="middle"
                                            fill="#22c55e"
                                            fontSize="11"
                                            fontWeight="bold"
                                        >
                                            Click to set reference
                                        </text>
                                    )}
                                </g>
                            )}

                            {currentPath.length > 0 && tool !== 'none' && tool !== 'dimension' && !isCalibrating && (
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
                {/* Calibration & Unit Controls */}
                {(calibrationScale !== null || isCalibrating) && (
                    <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl ring-1 ring-white/10">
                        <div className="text-xs text-slate-300 px-2">
                            {isCalibrating ? (
                                <span className="text-yellow-400 animate-pulse">Draw line & enter known distance...</span>
                            ) : (
                                <span>✓ Calibrated ({calibrationScale?.toFixed(2)} px/mm)</span>
                            )}
                        </div>
                        <div className="w-px h-4 bg-slate-700" />
                        <div className="flex gap-1">
                            {['mm', 'cm', 'in', 'ft'].map(u => (
                                <button
                                    key={u}
                                    onClick={() => setMeasurementUnit(u as any)}
                                    className={`px-2 py-1 text-[10px] uppercase rounded transition ${measurementUnit === u ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                                >
                                    {u}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                    <ToolBtn
                        active={isCalibrating}
                        onClick={() => setIsCalibrating(!isCalibrating)}
                        icon={<RulerIcon />}
                        title="Calibrate Scale"
                        color="text-yellow-400 hover:bg-yellow-500/10"
                    />
                    <ToolBtn active={tool === 'dimension'} onClick={() => setTool('dimension')} icon={<MeasureIcon />} title="Measure Distance" color="text-yellow-400 hover:bg-yellow-500/10" />
                    <div className="w-px h-6 bg-slate-700/50 mx-1" />
                    <ToolBtn onClick={handleUndo} disabled={history.length === 0} icon={<UndoIcon />} title="Undo" />
                    <ToolBtn onClick={handleRedo} disabled={redoStack.length === 0} icon={<RedoIcon />} title="Redo" />
                </div>
            </div>

            {/* ── Inline Balloon Input Panel (replaces native prompt()) ── */}
            {pendingBalloon && (
                <div
                    className="absolute z-50"
                    style={{
                        left: Math.min(pendingBalloon.screenX + 12, (containerRef.current?.clientWidth ?? 800) - 280),
                        top: Math.min(pendingBalloon.screenY + 12, (containerRef.current?.clientHeight ?? 600) - 180),
                        width: 268
                    }}
                >
                    <div className={`rounded-xl shadow-2xl border overflow-hidden ${pendingBalloon.type === 'issue'
                        ? 'bg-slate-900 border-red-500/60'
                        : 'bg-slate-900 border-blue-500/60'
                        }`}>
                        {/* Panel header */}
                        <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${pendingBalloon.type === 'issue' ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'
                            }`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${pendingBalloon.type === 'issue' ? 'bg-red-500' : 'bg-blue-500'
                                }`}>
                                {pendingBalloon.type === 'issue' ? '!' : '✎'}
                            </span>
                            {pendingBalloon.type === 'issue' ? 'Add Critical Issue' : 'Add Comment'}
                        </div>

                        {/* Text input */}
                        <div className="p-3">
                            <textarea
                                ref={balloonInputRef}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none h-20"
                                placeholder={pendingBalloon.type === 'issue' ? 'Describe the issue…' : 'Enter your comment…'}
                                value={pendingBalloon.text}
                                onChange={e => setPendingBalloon(prev => prev ? { ...prev, text: e.target.value } : null)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmBalloon() }
                                    if (e.key === 'Escape') { setPendingBalloon(null); setTool('none') }
                                }}
                            />
                            <p className="text-[10px] text-slate-600 mt-1">Enter to save · Shift+Enter for newline · Esc to cancel</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 px-3 pb-3">
                            <button
                                onClick={() => { setPendingBalloon(null); setTool('none') }}
                                className="flex-1 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBalloon}
                                disabled={!pendingBalloon.text.trim()}
                                className={`flex-1 py-1.5 text-xs font-semibold text-white rounded-lg transition disabled:opacity-40 ${pendingBalloon.type === 'issue'
                                    ? 'bg-red-600 hover:bg-red-500'
                                    : 'bg-blue-600 hover:bg-blue-500'
                                    }`}
                            >
                                Place Balloon
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Inline Calibration Panel (replaces native prompt()) ── */}
            {pendingCalibration && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50" style={{ width: 320 }}>
                    <div className="rounded-xl shadow-2xl border border-yellow-500/60 bg-slate-900 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-yellow-900/30 text-yellow-400">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center bg-yellow-500 text-white text-[10px] font-bold">📏</span>
                            Calibrate Scale
                        </div>
                        <div className="p-4 space-y-3">
                            <p className="text-xs text-slate-400">
                                Line drawn: <span className="text-white font-mono">{pendingCalibration.pixelDistance.toFixed(1)}px</span>
                            </p>
                            <div>
                                <label className="text-xs text-slate-300 block mb-1">Known distance (mm):</label>
                                <input
                                    type="number"
                                    autoFocus
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500"
                                    placeholder="e.g. 50"
                                    value={pendingCalibration.inputMm}
                                    onChange={e => setPendingCalibration(prev => prev ? { ...prev, inputMm: e.target.value } : null)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = parseFloat(pendingCalibration.inputMm)
                                            if (!isNaN(val) && val > 0) {
                                                setCalibrationScale(pendingCalibration.pixelDistance / val)
                                                showToast(`Calibrated: ${val}mm = ${pendingCalibration.pixelDistance.toFixed(1)}px`)
                                            }
                                            setPendingCalibration(null)
                                            setCurrentPath([])
                                        }
                                        if (e.key === 'Escape') {
                                            setPendingCalibration(null)
                                            setCurrentPath([])
                                        }
                                    }}
                                />
                            </div>
                            <p className="text-[10px] text-slate-600">Enter to confirm · Esc to cancel</p>
                        </div>
                        <div className="flex gap-2 px-4 pb-4">
                            <button
                                onClick={() => { setPendingCalibration(null); setCurrentPath([]) }}
                                className="flex-1 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const val = parseFloat(pendingCalibration.inputMm)
                                    if (!isNaN(val) && val > 0) {
                                        setCalibrationScale(pendingCalibration.pixelDistance / val)
                                        showToast(`Calibrated: ${val}mm = ${pendingCalibration.pixelDistance.toFixed(1)}px`)
                                    }
                                    setPendingCalibration(null)
                                    setCurrentPath([])
                                }}
                                disabled={!pendingCalibration.inputMm || isNaN(parseFloat(pendingCalibration.inputMm))}
                                className="flex-1 py-1.5 text-xs font-semibold text-white bg-yellow-600 hover:bg-yellow-500 rounded-lg transition disabled:opacity-40"
                            >
                                Set Scale
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast notification */}
            {toast && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 text-slate-200 text-sm px-5 py-3 rounded-full shadow-2xl z-50 pointer-events-none">
                    {toast}
                </div>
            )}
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
const RulerIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
const MeasureIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
