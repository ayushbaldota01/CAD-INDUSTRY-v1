
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const modelId = id
        const body = await req.json()
        const { role = 'viewer', expiresInDays = 7 } = body

        // 1. Generate High-Entropy Token
        const token = crypto.randomBytes(32).toString('hex')

        // 2. Hash Token (SHA-256)
        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex')

        // 3. Calculate Expiration
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expiresInDays)

        // 4. Insert into DB
        const { error } = await supabaseAdmin
            .from('share_tokens')
            .insert({
                model_id: modelId,
                token_hash: tokenHash,
                role,
                expires_at: expiresAt.toISOString()
            })

        if (error) {
            console.error('Share Token Error:', error)
            return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
        }

        // 5. Return URL using env var or origin
        // Assuming we are running on localhost or getting origin from headers
        const origin = req.headers.get('origin') || 'http://localhost:3000'
        const shareUrl = `${origin}/view/shared/${token}`

        return NextResponse.json({
            success: true,
            shareUrl,
            expiresAt
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
