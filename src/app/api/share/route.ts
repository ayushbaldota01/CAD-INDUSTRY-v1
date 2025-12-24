
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { fileId, accessMode = 'read-only', expiresInDays = 7 } = body

        if (!fileId) {
            return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
        }

        if (!['read-only', 'comment-only'].includes(accessMode)) {
            return NextResponse.json({ error: 'Invalid access mode' }, { status: 400 })
        }

        // Get current user (optional - can be null for public shares)
        const authHeader = req.headers.get('authorization')
        let userId = null

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '')
            const { data: { user } } = await supabaseAdmin.auth.getUser(token)
            userId = user?.id || null
        }

        // Generate secure random token
        const token = crypto.randomBytes(32).toString('hex')

        // Calculate expiration
        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null

        // Insert share token
        const { data, error } = await supabaseAdmin
            .from('share_tokens')
            .insert({
                file_id: fileId,
                token,
                access_mode: accessMode,
                created_by: userId,
                expires_at: expiresAt?.toISOString()
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating share token:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Generate share URL
        const origin = req.headers.get('origin') || 'http://localhost:3000'
        const shareUrl = `${origin}/share/${token}`

        return NextResponse.json({
            success: true,
            shareUrl,
            token,
            accessMode,
            expiresAt: expiresAt?.toISOString()
        })

    } catch (e: any) {
        console.error('Share API Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// Revoke a share token
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const token = searchParams.get('token')

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 })
        }

        const { error } = await supabaseAdmin
            .from('share_tokens')
            .update({ revoked: true })
            .eq('token', token)

        if (error) {
            console.error('Error revoking token:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Token revoked' })

    } catch (e: any) {
        console.error('Revoke API Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
