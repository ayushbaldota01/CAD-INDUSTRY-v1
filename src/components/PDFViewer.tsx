
'use client'

import React, { useMemo } from 'react'
import PdfAnnotator, { OverlayItem } from './PdfAnnotator'
import { useAnnotations } from '@/hooks/useAnnotations'

interface PDFViewerProps {
    url: string
    modelId: string
}

export default function PDFViewer({ url, modelId }: PDFViewerProps) {
    const { annotations, createAnnotation } = useAnnotations(modelId)

    // Map DB annotations to OverlayItems
    const overlayItems = useMemo<OverlayItem[]>(() => {
        return annotations.map(ann => {
            // Check if this annotation is for PDF (has 'page' in position)
            const pos = ann.position as unknown as { page: number, x: number, y: number, type?: string }

            // If it's a 3D annotation (array), skip or handle gracefully
            if (Array.isArray(ann.position)) return null

            return {
                id: ann.id,
                type: (ann.type === 'note' ? 'callout' : 'highlight') as any, // Simple mapping
                points: [{ x: pos.x, y: pos.y }],
                page: pos.page || 1,
                text: ann.text,
                color: 'red' // default
            }
        }).filter(Boolean) as OverlayItem[]
    }, [annotations])

    const handleSaveOverlay = async (item: OverlayItem) => {
        // Save to Supabase via hook
        // item.points is normalized {x,y}
        if (item.points.length === 0) return

        const page = item.page || 1
        const pos = { page, x: item.points[0].x, y: item.points[0].y }

        try {
            // We overload createAnnotation to accept the PDF position object
            // The hook expects { position: [x,y,z], ... } for 3D, but we modified the hook to send whatever we pass?
            // Actually createAnnotation in useAnnotations expects typed args for 3D.
            // We need to update useAnnotations to be more flexible or cast here.

            // For now, let's assume we can cast or update the hook slightly.
            // But wait, the hook specifically takes [number, number, number].
            // I should update the hook signature to allow generic JSON position.

            // NOTE context: "Create a Supabase SQL schema... position (jsonb)"
            // So the DB supports it. The hook typescript definition is the bottleneck.

            // Let's force it for now and I will update hook next.
            await createAnnotation({
                position: pos, // Pass proper { page, x, y } object
                normal: [0, 0, 0]
            } as any, item.text || '')

        } catch (e) {
            console.error('Failed to save PDF annotation', e)
        }
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
            />
        </div>
    )
}
