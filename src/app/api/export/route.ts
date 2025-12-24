
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const fileId = searchParams.get('fileId')
        const format = searchParams.get('format') || 'csv' // csv or json

        if (!fileId) {
            return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
        }

        // Fetch file info
        const { data: file, error: fileError } = await supabaseAdmin
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single()

        if (fileError || !file) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // Fetch annotations
        const { data: annotations, error: annError } = await supabaseAdmin
            .from('annotations')
            .select('*')
            .eq('file_id', fileId)
            .order('created_at', { ascending: true })

        if (annError) {
            return NextResponse.json({ error: annError.message }, { status: 500 })
        }

        // Fetch activity logs
        const { data: activityLogs, error: actError } = await supabaseAdmin
            .from('activity_logs')
            .select('*')
            .eq('file_id', fileId)
            .order('created_at', { ascending: true })

        if (actError) {
            return NextResponse.json({ error: actError.message }, { status: 500 })
        }

        if (format === 'csv') {
            // Generate CSV for annotations
            const annotationsCsv = generateAnnotationsCsv(annotations || [], file)
            const activityCsv = generateActivityCsv(activityLogs || [], file)

            // Combine both CSVs
            const combinedCsv = `FILE INFORMATION\nFile Name,${file.name}\nFile Type,${file.type}\nVersion,${file.version}\nCreated At,${file.created_at}\n\n${annotationsCsv}\n\n${activityCsv}`

            return new NextResponse(combinedCsv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${file.name}_export.csv"`
                }
            })
        } else {
            // Return JSON
            return NextResponse.json({
                file: {
                    name: file.name,
                    type: file.type,
                    version: file.version,
                    created_at: file.created_at
                },
                annotations: annotations || [],
                activityLogs: activityLogs || []
            })
        }

    } catch (e: any) {
        console.error('Export API Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

function generateAnnotationsCsv(annotations: any[], file: any): string {
    const headers = 'ANNOTATIONS\nID,Type,Text,Position,Created By,Created At'

    const rows = annotations.map(ann => {
        const position = typeof ann.position === 'object'
            ? JSON.stringify(ann.position).replace(/,/g, ';')
            : ann.position

        return `${ann.id},${ann.type},"${ann.text || ''}","${position}",${ann.created_by || 'Unknown'},${ann.created_at}`
    })

    return [headers, ...rows].join('\n')
}

function generateActivityCsv(logs: any[], file: any): string {
    const headers = 'ACTIVITY LOGS\nID,Action,User ID,Created At'

    const rows = logs.map(log => {
        return `${log.id},${log.action},${log.user_id || 'Unknown'},${log.created_at}`
    })

    return [headers, ...rows].join('\n')
}
