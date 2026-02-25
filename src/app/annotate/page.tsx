
'use client'

import React from 'react'
import PdfAnnotator, { OverlayItem } from '@/components/PdfAnnotator'
import { supabase } from '@/lib/supabaseClient'

export default function AnnotatePage() {
    // Demo PDF
    const pdfUrl = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf'

    const handleSave = async (items: OverlayItem[]) => {
        console.log('Overlay saved:', items)
        // In production: await supabase.from('pdf_overlays').upsert({ pdf_key: pdfUrl, overlay_json: items })
    }

    return (
        <div className="h-screen w-screen">
            <PdfAnnotator
                pdfUrl={pdfUrl}
                onSaveOverlay={handleSave}
            />
        </div>
    )
}
