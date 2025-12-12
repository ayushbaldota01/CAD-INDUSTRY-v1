
'use client'

import React from 'react'
import PdfAnnotator, { OverlayItem } from './PdfAnnotator'

interface PDFViewerProps {
    url: string
}

export default function PDFViewer({ url }: PDFViewerProps) {
    const handleSaveOverlay = (items: OverlayItem[]) => {
        // In a real app, save to Supabase
        console.log('Saved Overlay Items:', items)
        alert('Annotations saved locally (Console Log)')
    }

    if (!url) {
        return <div className="text-white p-10">No PDF URL provided</div>
    }

    return (
        <div className="w-full h-full">
            <PdfAnnotator
                pdfUrl={url}
                onSaveOverlay={handleSaveOverlay}
            />
        </div>
    )
}
