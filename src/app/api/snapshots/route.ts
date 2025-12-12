
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { modelId, imageData, camera } = body

        if (!modelId || !imageData) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Process Image (Data URL to Buffer)
        // Data URL format: "data:image/png;base64,iVBOR..."
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')

        // 2. Upload to Storage
        const fileName = `${modelId}/${uuidv4()}.png`
        const { error: uploadError } = await supabaseAdmin.storage
            .from('snapshots') // Ensure this bucket exists
            .upload(fileName, buffer, {
                contentType: 'image/png',
                upsert: false
            })

        if (uploadError) {
            console.error('Upload Error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload snapshot image' }, { status: 500 })
        }

        // 3. Get Public URL (optional, if bucket is public)
        const { data: publicUrlData } = supabaseAdmin.storage
            .from('snapshots')
            .getPublicUrl(fileName)

        // 4. Insert into DB
        const { data: snapshotData, error: dbError } = await supabaseAdmin
            .from('snapshots')
            .insert({
                model_id: modelId,
                camera_params: camera,
                file_key: fileName,
                width: 800, // Client should strictly send this, mocking for now
                height: 600
            })
            .select()
            .single()

        if (dbError) {
            console.error('DB Error:', dbError)
            return NextResponse.json({ error: 'Failed to save snapshot record' }, { status: 500 })
        }

        // 5. Insert Snapshot Annotations (if any)
        const { annotations } = body
        if (annotations && Array.isArray(annotations) && annotations.length > 0) {
            const annotationRecords = annotations.map((ann: any) => ({
                snapshot_id: snapshotData.id,
                annotation_id: ann.id,
                u: ann.u,
                v: ann.v
            }))

            const { error: annError } = await supabaseAdmin
                .from('snapshot_annotations')
                .insert(annotationRecords)

            if (annError) {
                console.error('Snapshot Annotations Error:', annError)
                // We don't fail the whole request, but we log it
            }
        }

        return NextResponse.json({
            success: true,
            snapshot: snapshotData,
            url: publicUrlData.publicUrl
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
