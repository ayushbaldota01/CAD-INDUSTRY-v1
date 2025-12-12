import React from 'react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'
import SharedViewerHelper from './SharedViewerHelper'

// Force dynamic rendering since we rely on DB checks per request time/params
export const dynamic = 'force-dynamic'

async function getSharedModel(token: string) {
    // 1. Hash the incoming token
    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')

    // 2. Validate against DB
    const { data: shareData, error } = await supabaseAdmin
        .from('share_tokens')
        .select(`
            role,
            expires_at,
            models (
                id,
                name,
                storage_key,
                file_type
            )
        `)
        .eq('token_hash', tokenHash)
        .single()

    if (error || !shareData) return null

    // 3. Check Expiration
    if (new Date(shareData.expires_at) < new Date()) {
        return { expired: true }
    }

    // 4. Get Signed URL for the file
    // Assumes 'models' bucket is private and we need a signed URL
    // If bucket is public, we can use getPublicUrl
    const model = shareData.models as any // cast for simplicity

    // Check if it's a raw URL (like the demo ones) or a storage key
    let fileUrl = ''
    if (model.storage_key.startsWith('http')) {
        fileUrl = model.storage_key
    } else {
        const { data: urlData } = await supabaseAdmin.storage
            .from('models') // Assuming 'models' bucket
            .createSignedUrl(model.storage_key, 3600) // 1 hour access

        fileUrl = urlData?.signedUrl || ''
    }

    // 5. Fetch Annotations (Read-Only for shared view typically, unless editor)
    const { data: annotations } = await supabaseAdmin
        .from('annotations')
        .select('*')
        .eq('model_id', model.id) // Ensure this is safe; using model.id from verified token relation

    return {
        model,
        role: shareData.role,
        fileUrl,
        annotations: annotations || []
    }
}

export default async function SharedViewPage({ params }: { params: { token: string } }) {
    const data = await getSharedModel(params.token)

    if (!data) return notFound()
    if ('expired' in data) {
        return (
            <div className="h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2 text-red-500">Link Expired</h1>
                    <p className="text-slate-400">This shared link is no longer valid.</p>
                </div>
            </div>
        )
    }

    const { model, fileUrl, annotations, role } = data

    return (
        <SharedViewerHelper
            model={model}
            fileUrl={fileUrl}
            initialAnnotations={annotations}
            role={role}
        />
    )
}
