
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    if (!id || id === 'demo' || id === 'undefined') {
        return NextResponse.json({ versions: [] })
    }

    try {
        // Get the current file info to find name and owner
        const { data: currentFile, error: fetchError } = await supabaseAdmin
            .from('files')
            .select('name, created_by')
            .eq('id', id)
            .single()

        if (fetchError || !currentFile) {
            // It might be a demo file or invalid ID
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // Get all versions
        const { data: versions, error: versionsError } = await supabaseAdmin
            .from('files')
            .select('id, version, created_at')
            .eq('name', currentFile.name)
            .eq('created_by', currentFile.created_by)
            .order('version', { ascending: false })

        if (versionsError) {
            return NextResponse.json({ error: versionsError.message }, { status: 500 })
        }

        return NextResponse.json({ versions })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
