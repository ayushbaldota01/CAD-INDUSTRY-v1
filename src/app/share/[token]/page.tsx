
import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import SharedViewerClient from './SharedViewerClient'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

async function getSharedFile(token: string) {
    // Validate token and get file info
    const { data: shareData, error } = await supabaseAdmin
        .from('share_tokens')
        .select(`
            access_mode,
            expires_at,
            revoked,
            file_id,
            files (
                id,
                name,
                type,
                storage_path,
                version
            )
        `)
        .eq('token', token)
        .single()

    if (error || !shareData) {
        return null
    }

    // Check if revoked
    if (shareData.revoked) {
        return { revoked: true }
    }

    // Check expiration
    if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        return { expired: true }
    }

    const file = shareData.files as any

    // Get signed URL for the file
    const { data: urlData } = await supabaseAdmin.storage
        .from('cad-files')
        .createSignedUrl(file.storage_path, 3600 * 24) // 24 hour access

    const fileUrl = urlData?.signedUrl || ''

    // Fetch annotations (read-only)
    const { data: annotations } = await supabaseAdmin
        .from('annotations')
        .select('*')
        .eq('file_id', file.id)

    return {
        file,
        fileUrl,
        annotations: annotations || [],
        accessMode: shareData.access_mode,
        token
    }
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const data = await getSharedFile(token)

    if (!data) {
        return notFound()
    }

    if ('revoked' in data) {
        return (
            <div className="h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold mb-2">Link Revoked</h1>
                    <p className="text-slate-400">
                        This shared link has been revoked and is no longer accessible.
                    </p>
                </div>
            </div>
        )
    }

    if ('expired' in data) {
        return (
            <div className="h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">⏰</div>
                    <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
                    <p className="text-slate-400">
                        This shared link has expired and is no longer valid.
                    </p>
                </div>
            </div>
        )
    }

    const { file, fileUrl, annotations, accessMode, token: shareToken } = data

    return (
        <SharedViewerClient
            file={file}
            fileUrl={fileUrl}
            initialAnnotations={annotations}
            accessMode={accessMode}
            shareToken={shareToken}
        />
    )
}
