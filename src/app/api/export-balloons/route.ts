/**
 * API Route: /api/export-balloons
 *
 * Exports balloon data as a professional .xlsx file.
 *
 * Supports:
 * - GET /api/export-balloons?fileId=xxx  → loads from Supabase
 * - POST with { balloons: PDFOverlayItem[], fileName: string } → from client state
 */

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface BalloonExportItem {
    id: string
    balloonNo?: number
    drawingReference?: string
    text?: string
    entityType?: string
    description?: string
    page?: number
    remarks?: string
}

// NOTE: xlsx@0.18.5 Community Edition does not support cell styling (cell.s).
// Structure, column widths, freeze, autofilter, and merges are fully supported.
// To add colors/bold, upgrade to SheetJS Pro or replace with exceljs.
function buildWorkbook(balloons: BalloonExportItem[], fileName: string): XLSX.WorkBook {
    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })

    // Sort by balloonNo
    const sorted = [...balloons].sort((a, b) => (a.balloonNo ?? 0) - (b.balloonNo ?? 0))

    // ─── Sheet 1: Balloon Report ───────────────────────────────────

    // Row 1: Header (merged)
    const headerText = `BALLOON INSPECTION REPORT — ${fileName} — ${date}`

    // Row 2: Column headers
    const columns = ['Balloon No.', 'Drawing Reference / Text', 'Type', 'Description', 'Page No.', 'Remarks']

    // Data rows
    const dataRows = sorted.map(item => [
        item.balloonNo ?? '-',
        item.drawingReference || item.text || '-',
        item.entityType || 'Note',
        item.description || '-',
        item.page ?? 1,
        item.remarks || '-',
    ])

    // Handle empty state
    if (dataRows.length === 0) {
        dataRows.push(['-', 'No balloons recorded', '-', '-', '-', '-'])
    }

    // Build AOA (Array of Arrays)
    const aoa = [
        [headerText, '', '', '', '', ''],  // Row 1 — will be merged
        columns,                             // Row 2 — headers
        ...dataRows,                         // Data rows
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Merge header row A1:F1
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]

    // Column widths: A=12, B=35, C=18, D=40, E=10, F=30
    ws['!cols'] = [
        { wch: 12 },
        { wch: 35 },
        { wch: 18 },
        { wch: 40 },
        { wch: 10 },
        { wch: 30 },
    ]

    // Freeze panes at row 3 (after header + column headers)
    ws['!freeze'] = { xSplit: 0, ySplit: 2 }

    // Auto-filter on header row (row index 1 = row 2)
    ws['!autofilter'] = { ref: `A2:F${aoa.length}` }

    // Row heights
    ws['!rows'] = [
        { hpt: 30 },   // Row 1 — header
        { hpt: 22 },   // Row 2 — column headers
    ]

    // NOTE: The community edition of xlsx does not support cell styling (cell.s) or sheet protection (!protect).
    // Only structural features like merges, column widths, freeze panes, and autofilters are supported.

    // ─── Sheet 2: Summary ──────────────────────────────────────────

    const typeCounts = new Map<string, number>()
    for (const item of sorted) {
        const type = item.entityType || 'Note'
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
    }

    const summaryAoa = [
        ['BALLOON SUMMARY'],
        [''],
        ['Entity Type', 'Count'],
        ...Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]),
        [''],
        ['Total', sorted.length],
    ]

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa)
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 10 }]
    summaryWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]

    // Build workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Balloon Report')
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    return wb
}

// ─── GET handler — loads from Supabase ─────────────────────────────────────

export async function GET(request: NextRequest) {
    const fileId = request.nextUrl.searchParams.get('fileId')

    if (!fileId) {
        return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    try {
        // Dynamic import to avoid bundling supabaseAdmin on client
        const { supabaseAdmin } = await import('@/lib/supabaseAdmin')

        const { data, error } = await supabaseAdmin
            .from('annotations')
            .select('*')
            .eq('file_id', fileId)

        if (error) throw error

        // Extract balloon data from annotations
        const balloons: BalloonExportItem[] = (data || [])
            .map((ann: { id: string; position: Record<string, unknown>; text?: string }) => {
                const pos = ann.position as Record<string, unknown>
                if (!pos || Array.isArray(pos)) return null
                if (!pos.points) return null

                return {
                    id: ann.id,
                    balloonNo: pos.balloonNo as number | undefined,
                    drawingReference: (pos.drawingReference as string) || (ann.text as string) || '',
                    text: ann.text || '',
                    entityType: (pos.entityType as string) || 'Note',
                    description: (pos.description as string) || '',
                    page: (pos.page as number) || 1,
                    remarks: (pos.remarks as string) || '',
                }
            })
            .filter(Boolean) as BalloonExportItem[]

        // Get file name
        const { data: fileData } = await supabaseAdmin
            .from('files')
            .select('name')
            .eq('id', fileId)
            .single()

        const fileName = fileData?.name || 'Unknown'

        const wb = buildWorkbook(balloons, fileName)
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Balloon_Report_${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
            },
        })
    } catch (err) {
        console.error('Export error:', err)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}

// ─── POST handler — from client state ──────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { balloons, fileName } = body as {
            balloons: BalloonExportItem[]
            fileName: string
        }

        if (!balloons || !Array.isArray(balloons)) {
            return NextResponse.json({ error: 'balloons array is required' }, { status: 400 })
        }

        const wb = buildWorkbook(balloons, fileName || 'Drawing')
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Balloon_Report_${(fileName || 'Drawing').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
            },
        })
    } catch (err) {
        console.error('Export error:', err)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}
