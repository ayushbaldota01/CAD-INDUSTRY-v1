
'use client'

import React, { useMemo, useState } from 'react'
import PdfAnnotator, { OverlayItem } from './PdfAnnotator'
import BalloonList from './BalloonList'
import { useAnnotations } from '@/hooks/useAnnotations'
import { extractTextFromPDF, analyzeTextItems } from '@/lib/autoBalloon'
import * as XLSX from 'xlsx'
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
    const { annotations, createAnnotation, updateAnnotation, deleteAnnotation } = useAnnotations(modelId)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [showSidebar, setShowSidebar] = useState(true)
    const [isAutoBallooning, setIsAutoBallooning] = useState(false)

    // Map DB annotations to OverlayItems
    const overlayItems = useMemo<OverlayItem[]>(() => {
        return annotations.map(ann => {
            // Check if this annotation is for PDF (has 'page' in position)
            const pos = ann.position as any

            // If it's a 3D annotation (array), skip
            if (Array.isArray(pos)) return null

            // Detect legacy or new format
            // New format: pos contains { page, type, points, color, ... }
            if (pos.points && Array.isArray(pos.points)) {
                return {
                    id: ann.id,
                    type: pos.type || 'comment', // Restored type
                    points: pos.points,
                    page: pos.page || 1,
                    text: ann.text || pos.text,
                    color: pos.color || 'red',
                    // New Metadata Fields
                    balloonNo: pos.balloonNo,
                    entityType: pos.entityType,
                    description: pos.description,
                    remarks: pos.remarks,
                    drawingReference: pos.drawingReference
                }
            }

            // Legacy format fallback (point only)
            return {
                id: ann.id,
                type: 'callout',
                points: [{ x: pos.x || 0, y: pos.y || 0 }],
                page: pos.page || 1,
                text: ann.text,
                color: 'red',
                balloonNo: 0 // Will display as index fallback
            }
        }).filter(Boolean) as OverlayItem[]
    }, [annotations])

    const handleSaveOverlay = async (item: OverlayItem): Promise<OverlayItem | null> => {
        if (!item.points.length) return null

        const page = item.page || 1

        // Auto-assign balloon number if new and missing
        let balloonNo = item.balloonNo
        if (!balloonNo) {
            const maxNo = overlayItems.reduce((max, i) => Math.max(max, i.balloonNo || 0), 0)
            balloonNo = maxNo + 1
        }

        // Store full metadata in the position JSONB
        const posPayload = {
            page,
            type: item.type,
            points: item.points,
            color: item.color,
            text: item.text, // Backup text in position
            // New Fields
            balloonNo,
            entityType: item.entityType || 'Note',
            description: item.description || '',
            remarks: item.remarks || '',
            drawingReference: item.drawingReference || ''
        }

        try {
            const newAnn = await createAnnotation({
                position: posPayload,
                normal: [0, 0, 0] // dummy
            } as any, item.text || '')

            if (newAnn) {
                return { ...item, id: newAnn.id, balloonNo }
            }

        } catch (e) {
            console.error('Failed to save PDF annotation', e)
        }
        return null
    }

    const handleUpdateOverlay = async (id: string, updates: Partial<OverlayItem>) => {
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
            drawingReference: merged.drawingReference
        }

        await updateAnnotation(id, {
            position: posPayload,
            text: merged.text
        })
    }

    // ===========================================
    // AUTO BALLOON ENGINE
    // ===========================================
    const handleAutoBalloon = async () => {
        setIsAutoBallooning(true)
        try {
            const extracted = await extractTextFromPDF(url)
            const candidates = analyzeTextItems(extracted)

            // Find max existing balloon number
            let nextNo = overlayItems.reduce((max, i) => Math.max(max, i.balloonNo || 0), 0) + 1

            // Batch create items
            let count = 0
            for (const item of candidates) {
                // Convert rect center to point
                // item.x, item.y are top-left normalized
                const centerX = item.x + (item.width / 2)
                const centerY = item.y + (item.height / 2)

                const newItem: OverlayItem = {
                    id: uuidv4(),
                    type: 'comment',
                    points: [{ x: centerX, y: centerY }],
                    page: item.page,
                    text: item.text,
                    color: '#3b82f6',
                    balloonNo: nextNo++,
                    entityType: item.type as any, // 'Dimension' | 'Note' ...
                    drawingReference: item.text,
                    description: `Auto-detected ${item.type}`,
                }

                await handleSaveOverlay(newItem)
                count++
            }

            if (count > 0) {
                alert(`Auto-ballooning complete! Created ${count} balloons.`)
            } else {
                alert('No new engineering entities found to balloon.')
            }

        } catch (e) {
            console.error("Auto balloon error:", e)
            alert("Failed to run auto-ballooning.")
        } finally {
            setIsAutoBallooning(false)
        }
    }

    // ===========================================
    // EXCEL EXPORT
    // ===========================================
    const handleExport = () => {
        if (overlayItems.length === 0) {
            alert("No balloons to export.")
            return
        }

        const data = overlayItems
            .sort((a, b) => (a.balloonNo || 0) - (b.balloonNo || 0))
            .map(item => ({
                "Balloon No.": item.balloonNo,
                "Reference": item.drawingReference || item.text || '-',
                "Type": item.entityType || 'Note',
                "Description": item.description || '-',
                "Page": item.page,
                "Remarks": item.remarks || '-'
            }))

        const ws = XLSX.utils.json_to_sheet(data)

        // Auto-width columns
        const wscols = Object.keys(data[0]).map(k => ({ wch: 20 }))
        ws['!cols'] = wscols

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Inspection Report")

        // Save file
        XLSX.writeFile(wb, `Inspection_Report_${new Date().toISOString().slice(0, 10)}.xlsx`)
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
                    onDeleteAnnotation={deleteAnnotation}
                />

                {/* Sidebar Toggle Button */}
                <button
                    onClick={() => setShowSidebar(prev => !prev)}
                    className="absolute top-4 right-4 z-10 bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-700 hover:bg-slate-700 transition"
                >
                    {showSidebar ? (
                        <ChevronRightIcon />
                    ) : (
                        <ChevronLeftIcon />
                    )}
                </button>

                {/* Loading Indicator */}
                {isAutoBallooning && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
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
                        onDelete={deleteAnnotation}
                        onAutoBalloon={handleAutoBalloon}
                        onExport={handleExport}
                    />
                </div>
            </div>
        </div>
    )
}
