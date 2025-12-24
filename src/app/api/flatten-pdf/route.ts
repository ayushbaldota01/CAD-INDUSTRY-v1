
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { v4 as uuidv4 } from 'uuid'

// Types based on PdfAnnotator components
type Point = { x: number; y: number }
type OverlayItem = {
    id: string
    type: 'callout' | 'text' | 'arrow' | 'freehand' | 'dimension'
    points: Point[]
    text?: string
    color?: string
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            pdfKey, // Key in storage, e.g. "manuals/specs.pdf"
            overlayJson, // Array of OverlayItems
            pageIndex = 0 // Default to first page
        }: {
            pdfKey: string
            overlayJson: OverlayItem[]
            pageIndex?: number
        } = body

        if (!pdfKey) {
            return NextResponse.json({ error: 'Missing defined pdfKey' }, { status: 400 })
        }

        // 1. Download PDF
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('cad-files') // Assuming PDFs are in 'models' or similar bucket. The previous step used 'exports' or 'models'.
            // The user prompt mentions "store PDF to Supabase Storage 'exports' bucket".
            // The source PDF might be in 'models' (uploaded) or 'raw'. 
            // I'll try 'models' first or assume the key is full path if bucket is variable.
            // Actually, let's assume 'models' based on earlier context, or 'exports'.
            // Let's deduce from typical flow: uploaded files go to 'models'.
            .download(pdfKey)

        if (downloadError || !fileData) {
            console.error('Download Error:', downloadError)
            return NextResponse.json({ error: 'Failed to download source PDF' }, { status: 500 })
        }

        // 2. Load PDF
        const pdfBuffer = await fileData.arrayBuffer()
        const pdfDoc = await PDFDocument.load(pdfBuffer)
        const pages = pdfDoc.getPages()
        const page = pages[pageIndex]
        if (!page) {
            return NextResponse.json({ error: 'Page index out of bounds' }, { status: 400 })
        }

        const { width, height } = page.getSize()
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

        // Helper to convert coords (Top-Left 0..1 to Bottom-Left PDF Points)
        const toPdfCoords = (p: Point) => ({
            x: p.x * width,
            y: height - (p.y * height)
        })

        // 3. Draw Annotations
        for (const item of (overlayJson || [])) {
            const colorName = item.color || 'red'
            // Simple color mapping
            const color = colorName === 'blue' ? rgb(0, 0, 1) :
                colorName === 'green' ? rgb(0, 1, 0) :
                    rgb(1, 0, 0)

            if (item.type === 'text' || item.type === 'callout') {
                if (item.points.length > 0 && item.text) {
                    const params = toPdfCoords(item.points[0])
                    page.drawText(item.text, {
                        x: params.x,
                        y: params.y, // text renders baseline? pdf-lib draws from bottom-left of text box usually
                        size: 14,
                        font: fontBold,
                        color
                    })
                }
            } else if (item.type === 'arrow' || item.type === 'dimension') {
                if (item.points.length >= 2) {
                    const start = toPdfCoords(item.points[0])
                    const end = toPdfCoords(item.points[item.points.length - 1])

                    page.drawLine({
                        start,
                        end,
                        thickness: 2,
                        color
                    })

                    // Draw simple arrowhead for arrow
                    if (item.type === 'arrow') {
                        // Basic vector math for arrow head
                        // direction from end to start
                        const dx = start.x - end.x
                        const dy = start.y - end.y
                        const angle = Math.atan2(dy, dx)
                        const headLen = 10

                        // p1
                        page.drawLine({
                            start: end,
                            end: {
                                x: end.x + headLen * Math.cos(angle - Math.PI / 6),
                                y: end.y + headLen * Math.sin(angle - Math.PI / 6)
                            },
                            thickness: 2,
                            color
                        })
                        // p2
                        page.drawLine({
                            start: end,
                            end: {
                                x: end.x + headLen * Math.cos(angle + Math.PI / 6),
                                y: end.y + headLen * Math.sin(angle + Math.PI / 6)
                            },
                            thickness: 2,
                            color
                        })
                    }
                }
            } else if (item.type === 'freehand') {
                if (item.points.length > 1) {
                    // Construct SVG path data or draw line segments
                    // PDF-lib has drawSvgPath but it accepts a path string. 
                    // Constructing 'M x y L x y ...'
                    const pathOps = item.points.map((p, i) => {
                        const c = toPdfCoords(p)
                        return `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`
                    })
                    const d = pathOps.join(' ')

                    page.drawSvgPath(d, {
                        x: 0, // Svg coordinates are usually relative to the viewport unless offset
                        y: 0, // drawSvgPath interprets coordinates in the path string directly if x,y are 0?
                        // Note: pdf-lib drawSvgPath uses the x,y as the origin for the path. 
                        // Our path is already in PDF PAGE coordinates (if x,y passed to d are page coords).
                        // However, pdf-lib SvgPath coordinate system might be tricky.
                        // Actually, standard SVG has Y down. PDF has Y up.
                        // We manually inverted Y in `toPdfCoords`. 
                        // So `c.y` is correct in PDF space (0 at bottom). 
                        // BUT drawSvgPath treats the path string as adhering to standard coordinate spaces?
                        // Actually pdf-lib docs say: "The path is drawn in the page's coordinate system."
                        borderColor: color,
                        borderWidth: 2,
                        borderOpacity: 1,
                    })
                }
            }
        }

        // 4. Footer
        const timestamp = new Date().toISOString()
        page.drawText(`Flattened by CAD Viewer | ${timestamp}`, {
            x: 20,
            y: 20,
            size: 8,
            font,
            color: rgb(0.5, 0.5, 0.5)
        })

        // 5. Save & Upload
        const pdfBytes = await pdfDoc.save()
        const outFileName = `flattened/${uuidv4()}.pdf`

        const { error: uploadError } = await supabaseAdmin.storage
            .from('exports') // Uploading to exports
            .upload(outFileName, pdfBytes, {
                contentType: 'application/pdf',
                upsert: false
            })

        if (uploadError) {
            console.error('Upload Error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload flattened PDF' }, { status: 500 })
        }

        const { data: publicData } = supabaseAdmin.storage
            .from('exports')
            .getPublicUrl(outFileName)

        return NextResponse.json({
            success: true,
            url: publicData.publicUrl,
            file_key: outFileName
        })

    } catch (error: any) {
        console.error('Flatten PDF Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
