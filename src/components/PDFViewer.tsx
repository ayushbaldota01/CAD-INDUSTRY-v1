
'use client'

import React, { useMemo } from 'react'
import PdfAnnotator, { OverlayItem } from './PdfAnnotator'
import { useAnnotations } from '@/hooks/useAnnotations'

interface PDFViewerProps {
    url: string
    modelId: string
}

export default function PDFViewer({ url, modelId }: PDFViewerProps) {
    const { annotations, createAnnotation, deleteAnnotation } = useAnnotations(modelId)

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
                    color: pos.color || 'red'
                }
            }

            // Legacy format fallback (point only)
            return {
                id: ann.id,
                type: 'callout',
                points: [{ x: pos.x || 0, y: pos.y || 0 }],
                page: pos.page || 1,
                text: ann.text,
                color: 'red'
            }
        }).filter(Boolean) as OverlayItem[]
    }, [annotations])

    const handleSaveOverlay = async (item: OverlayItem): Promise<OverlayItem | null> => {
        if (!item.points.length) return null

        const page = item.page || 1

        // Store full metadata in the position JSONB
        const posPayload = {
            page,
            type: item.type,
            points: item.points,
            color: item.color,
            text: item.text // Backup text in position
        }

        try {
            const newAnn = await createAnnotation({
                position: posPayload,
                normal: [0, 0, 0] // dummy
            } as any, item.text || '')

            if (newAnn) {
                return { ...item, id: newAnn.id }
            }

        } catch (e) {
            console.error('Failed to save PDF annotation', e)
        }
        return null
    }

    if (!url) {
        return <div className="text-white p-10">No PDF URL provided</div>
    }

    return (
        <div className="w-full h-full">
            <PdfAnnotator
                pdfUrl={url}
                overlayJson={overlayItems}
                onSaveAnnotation={handleSaveOverlay}
                onDeleteAnnotation={deleteAnnotation}
            />
        </div>
    )
}
