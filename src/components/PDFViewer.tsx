'use client'

import React, { useMemo, useState, useCallback } from 'react'
import PdfAnnotator from './PdfAnnotator'
import type { PDFOverlayItem } from '@/types'
import BalloonList from './BalloonList'
import { useAnnotations } from '@/hooks/useAnnotations'
import { runAutoBalloon, ScannedPDFError } from '@/lib/autoBalloon'
import { resequenceBalloons, nextBalloonNo } from '@/lib/balloonUtils'
import { AlertDialog } from '@/components/ui/Dialogs'
import { v4 as uuidv4 } from 'uuid'

// Simple icons for the sidebar toggle
const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
    </svg>
)

const ChevronRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
    </svg>
)

interface PDFViewerProps {
    url: string
    modelId: string
}

export default function PDFViewer({ url, modelId }: PDFViewerProps) {
    const { annotations, createAnnotation, updateAnnotation, deleteAnnotation, refresh } = useAnnotations(modelId)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showSidebar, setShowSidebar] = useState(true)
    const [isAutoBallooning, setIsAutoBallooning] = useState(false)
    const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; variant: 'info' | 'success' | 'warning' | 'error' } | null>(null)

    // Map DB annotations to PDFOverlayItems
    const overlayItems = useMemo<PDFOverlayItem[]>(() => {
        return annotations.map(ann => {
            const pos = ann.position as any
            if (Array.isArray(pos)) return null

            if (pos.points && Array.isArray(pos.points)) {
                const firstPt = pos.points[0] || { x: 0, y: 0 }
                return {
                    id: ann.id,
                    type: pos.type || 'comment',
                    points: pos.points,
                    x: firstPt.x,
                    y: firstPt.y,
                    page: pos.page || 1,
                    text: ann.text || pos.text,
                    color: pos.color || 'red',
                    balloonNo: pos.balloonNo,
                    entityType: pos.entityType,
                    description: pos.description,
                    remarks: pos.remarks,
                    drawingReference: pos.drawingReference,
                    confidence: pos.confidence,
                    autoDetected: pos.autoDetected,
                    sourceText: pos.sourceText,
                    leaderOffset: pos.leaderOffset,
                }
            }

            // Legacy format fallback
            return {
                id: ann.id,
                type: 'callout' as const,
                points: [{ x: pos.x || 0, y: pos.y || 0 }],
                x: pos.x || 0,
                y: pos.y || 0,
                page: pos.page || 1,
                text: ann.text,
                color: 'red',
                balloonNo: undefined,
            }
        }).filter(Boolean) as PDFOverlayItem[]
    }, [annotations])

    const BALLOON_TYPES = ['comment', 'issue', 'callout'] as const
    type BalloonType = typeof BALLOON_TYPES[number]

    const isBalloonType = (type: string): type is BalloonType =>
        (BALLOON_TYPES as readonly string[]).includes(type)

    /** Derive entity label from colour — blue→Comment, red/issue→Critical */
    const colorToEntityType = (color: string | undefined, type: string): string => {
        const c = (color || '').toLowerCase()
        if (type === 'issue') return 'Critical'
        if (c.includes('#ef') || c.includes('#f87') || c === 'red' || c.includes('#dc') || c.includes('#b91')) return 'Critical'
        if (c.includes('#3b8') || c.includes('#60a') || c.includes('#2563') || c === 'blue' || c.includes('#0ea')) return 'Comment'
        return 'Note'
    }

    const handleSaveOverlay = async (item: PDFOverlayItem): Promise<PDFOverlayItem | null> => {
        if (!item.points.length) return null

        const page = item.page || 1
        const isBalloon = isBalloonType(item.type)

        // Only balloon types get an auto-incremented number
        let balloonNo = item.balloonNo
        if (isBalloon && !balloonNo) {
            balloonNo = nextBalloonNo(overlayItems)
        }

        const entityType = item.entityType || colorToEntityType(item.color, item.type)

        // Store full metadata in the position JSONB
        const posPayload = {
            page,
            type: item.type,
            points: item.points,
            color: item.color,
            text: item.text,
            // Balloon-only fields — undefined for non-balloon types
            ...(isBalloon ? {
                balloonNo,
                entityType,
                description: item.description || '',
                remarks: item.remarks || '',
                drawingReference: item.drawingReference || '',
                leaderOffset: item.leaderOffset || { x: 0.04, y: -0.04 },
                confidence: item.confidence,
                autoDetected: item.autoDetected ?? false,
                sourceText: item.sourceText || '',
            } : {})
        }

        try {
            const newAnn = await createAnnotation({
                position: posPayload,
                normal: [0, 0, 0]
            } as any, item.text || '')

            if (newAnn) {
                return { ...item, id: newAnn.id, balloonNo, entityType: entityType as any }
            }
        } catch (e) {
            console.error('Failed to save PDF annotation', e)
        }
        return null
    }

    const handleUpdateOverlay = async (id: string, updates: Partial<PDFOverlayItem>) => {
        const existing = overlayItems.find(i => i.id === id)
        if (!existing) return

        const merged = { ...existing, ...updates }

        // Reconstruct position payload
        const posPayload = {
            page: merged.page,
            type: merged.type,
            points: merged.points,
            color: merged.color,
            text: merged.text,
            balloonNo: merged.balloonNo,
            entityType: merged.entityType,
            description: merged.description,
            remarks: merged.remarks,
            drawingReference: merged.drawingReference,
            leaderOffset: merged.leaderOffset,
            confidence: merged.confidence,
            autoDetected: merged.autoDetected,
            sourceText: merged.sourceText,
        }

        await updateAnnotation(id, {
            // posPayload is a JSONB object stored as position — cast to bypass tuple type
            position: posPayload as any,
            text: merged.text
        })
    }

    // ===========================================
    // AUTO BALLOON ENGINE (uses new module)
    // ===========================================
    const handleAutoBalloon = async () => {
        setIsAutoBallooning(true)
        try {
            const existingCount = overlayItems.filter(i => isBalloonType(i.type)).length
            const detected = await runAutoBalloon(url, existingCount)

            let count = 0
            for (const item of detected) {
                // Assign unique ID
                const newItem: PDFOverlayItem = {
                    ...item,
                    id: uuidv4(),
                }
                await handleSaveOverlay(newItem)
                count++
            }

            if (count > 0) {
                setAlertDialog({
                    title: 'Auto-Balloon Complete',
                    message: `Created ${count} balloons from detected engineering entities (dimensions, tolerances, GD&T, threads, etc.).`,
                    variant: 'success',
                })
            } else {
                setAlertDialog({
                    title: 'No Entities Found',
                    message: 'No engineering entities were detected. This may be a scanned drawing or a drawing without text annotations.',
                    variant: 'info',
                })
            }
        } catch (e) {
            console.error('Auto balloon error:', e)
            if (e instanceof ScannedPDFError) {
                setAlertDialog({
                    title: 'Scanned Drawing Detected',
                    message: e.message,
                    variant: 'warning',
                })
            } else {
                setAlertDialog({
                    title: 'Auto-Balloon Failed',
                    message: 'An error occurred while analyzing the drawing. Please try again.',
                    variant: 'error',
                })
            }
        } finally {
            setIsAutoBallooning(false)
        }
    }

    // BUG 2 FIX: Wrap deleteAnnotation to resequence balloon numbers after delete
    const handleDeleteOverlay = useCallback(async (id: string) => {
        await deleteAnnotation(id)
        // Resequence remaining balloons after state settles
        setTimeout(async () => {
            const remaining = overlayItems.filter(i => i.id !== id)
            const resequenced = resequenceBalloons(remaining)
            for (const item of resequenced) {
                const original = remaining.find(r => r.id === item.id)
                if (original && original.balloonNo !== item.balloonNo) {
                    await handleUpdateOverlay(item.id, { balloonNo: item.balloonNo })
                }
            }
            await refresh()
        }, 100)
    }, [deleteAnnotation, overlayItems, handleUpdateOverlay, refresh])

    // ===========================================
    // EXCEL EXPORT — BUG 3b FIX: POST to API route instead of client-side XLSX
    // ===========================================
    const handleExport = async () => {
        const balloons = overlayItems.filter(i => isBalloonType(i.type))
        if (balloons.length === 0) {
            setAlertDialog({ title: 'Nothing to Export', message: 'Add balloon annotations before exporting.', variant: 'warning' })
            return
        }
        try {
            setAlertDialog(null)
            const res = await fetch('/api/export-balloons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ balloons, fileName: 'Drawing' }),
            })
            if (!res.ok) throw new Error('Export failed')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Balloon_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
            document.body.appendChild(a)
            a.click()
            URL.revokeObjectURL(url)
            document.body.removeChild(a)
            setAlertDialog({ title: 'Export Complete', message: `${balloons.length} balloons exported to Excel.`, variant: 'success' })
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error'
            setAlertDialog({ title: 'Export Failed', message: msg, variant: 'error' })
        }
    }

    if (!url) {
        return <div className="text-white p-10">No PDF URL provided</div>
    }

    return (
        <div className="w-full h-full flex overflow-hidden">
            {/* Main Viewer Area */}
            <div className="flex-1 relative">
                <PdfAnnotator
                    pdfUrl={url}
                    overlayJson={overlayItems}
                    onSaveAnnotation={handleSaveOverlay}
                    onDeleteAnnotation={handleDeleteOverlay}
                    onUpdateLeader={(id, leaderOffset) => handleUpdateOverlay(id, { leaderOffset })}
                />

                {/* Sidebar Toggle Button */}
                <button
                    onClick={() => setShowSidebar(prev => !prev)}
                    className="absolute top-4 right-4 z-10 bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-700 hover:bg-slate-700 transition"
                >
                    {showSidebar ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                </button>

                {/* Auto-Balloon Loading Overlay */}
                {isAutoBallooning && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <div className="text-lg font-bold text-slate-800">Analyzing Drawing...</div>
                            <p className="text-slate-500 text-sm">Extracting text and identifying dimensions</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Balloon Management Sidebar */}
            <div className={`transition-all duration-300 ${showSidebar ? 'w-80' : 'w-0'} overflow-hidden`}>
                <div className="w-80 h-full">
                    <BalloonList
                        items={overlayItems}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onUpdate={handleUpdateOverlay}
                        onDelete={handleDeleteOverlay}
                        onAutoBalloon={handleAutoBalloon}
                        onExport={handleExport}
                    />
                </div>
            </div>

            {/* Alert Dialog — replaces all native alert() calls */}
            {alertDialog && (
                <AlertDialog
                    isOpen={true}
                    onClose={() => setAlertDialog(null)}
                    title={alertDialog.title}
                    message={alertDialog.message}
                    variant={alertDialog.variant}
                />
            )}
        </div>
    )
}

