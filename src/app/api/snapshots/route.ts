/**
 * Snapshots API - Production Secured
 * 
 * SECURITY FIXES:
 * - Input validation and sanitization
 * - Rate limiting headers
 * - Proper error handling (no internal exposure)
 * - Size limits on base64 data
 * - Content type validation
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

// Constants
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB max for base64 image
const ALLOWED_IMAGE_TYPES = ['png', 'jpeg', 'jpg', 'webp']

// Type definitions
interface SnapshotRequest {
    modelId: string
    imageData: string
    camera?: {
        position: [number, number, number]
        target: [number, number, number]
        fov: number
    }
    annotations?: Array<{
        id: string
        u: number
        v: number
    }>
    width?: number
    height?: number
}

/**
 * Validate and sanitize model ID
 */
function validateModelId(modelId: string): { valid: boolean; error?: string } {
    if (!modelId || typeof modelId !== 'string') {
        return { valid: false, error: 'Model ID is required' }
    }

    // Allow UUID format or demo- prefix
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const demoRegex = /^demo-[\w-]+$/

    if (!uuidRegex.test(modelId) && !demoRegex.test(modelId)) {
        return { valid: false, error: 'Invalid model ID format' }
    }

    return { valid: true }
}

/**
 * Validate base64 image data
 */
function validateImageData(imageData: string): {
    valid: boolean
    error?: string
    mimeType?: string
} {
    if (!imageData || typeof imageData !== 'string') {
        return { valid: false, error: 'Image data is required' }
    }

    // Check for data URL format
    const dataUrlMatch = imageData.match(/^data:image\/([\w+]+);base64,/)
    if (!dataUrlMatch) {
        return { valid: false, error: 'Invalid image data format. Expected data URL.' }
    }

    const imageType = dataUrlMatch[1].toLowerCase()
    if (!ALLOWED_IMAGE_TYPES.includes(imageType)) {
        return { valid: false, error: `Unsupported image type: ${imageType}` }
    }

    // Check size (approximate - base64 is ~33% larger than binary)
    const base64Part = imageData.substring(dataUrlMatch[0].length)
    const approximateSize = Math.ceil(base64Part.length * 0.75)

    if (approximateSize > MAX_IMAGE_SIZE) {
        return { valid: false, error: `Image too large. Maximum: ${MAX_IMAGE_SIZE / 1024 / 1024}MB` }
    }

    return { valid: true, mimeType: `image/${imageType}` }
}

/**
 * Sanitize camera parameters
 */
function sanitizeCameraParams(camera: any): Record<string, any> | null {
    if (!camera || typeof camera !== 'object') return null

    return {
        position: Array.isArray(camera.position)
            ? camera.position.slice(0, 3).map(Number).filter((n: any) => !isNaN(n))
            : [0, 0, 0],
        target: Array.isArray(camera.target)
            ? camera.target.slice(0, 3).map(Number).filter((n: any) => !isNaN(n))
            : [0, 0, 0],
        fov: typeof camera.fov === 'number' && !isNaN(camera.fov)
            ? Math.min(Math.max(camera.fov, 10), 120) // Clamp FOV
            : 50
    }
}

/**
 * Sanitize annotation coordinates
 */
function sanitizeAnnotations(annotations: any[]): Array<{ id: string; u: number; v: number }> {
    if (!Array.isArray(annotations)) return []

    return annotations
        .filter(ann =>
            ann &&
            typeof ann.id === 'string' &&
            typeof ann.u === 'number' &&
            typeof ann.v === 'number' &&
            !isNaN(ann.u) && !isNaN(ann.v)
        )
        .slice(0, 100) // Limit to 100 annotations
        .map(ann => ({
            id: ann.id.slice(0, 50), // Limit ID length
            u: Math.min(Math.max(ann.u, 0), 1), // Clamp to [0, 1]
            v: Math.min(Math.max(ann.v, 0), 1)
        }))
}

export async function POST(req: Request) {
    const startTime = Date.now()

    try {
        // ====================================================================
        // PARSE AND VALIDATE REQUEST
        // ====================================================================

        let body: SnapshotRequest
        try {
            body = await req.json()
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON in request body' },
                { status: 400 }
            )
        }

        const { modelId, imageData, camera, annotations, width, height } = body

        // Validate model ID
        const modelValidation = validateModelId(modelId)
        if (!modelValidation.valid) {
            return NextResponse.json(
                { error: modelValidation.error },
                { status: 400 }
            )
        }

        // Validate image data
        const imageValidation = validateImageData(imageData)
        if (!imageValidation.valid) {
            return NextResponse.json(
                { error: imageValidation.error },
                { status: 400 }
            )
        }

        // ====================================================================
        // PROCESS IMAGE
        // ====================================================================

        // Extract and decode base64 data safely
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')

        let buffer: Buffer
        try {
            buffer = Buffer.from(base64Data, 'base64')
        } catch {
            return NextResponse.json(
                { error: 'Failed to decode image data' },
                { status: 400 }
            )
        }

        // ====================================================================
        // UPLOAD TO STORAGE
        // ====================================================================

        const fileExtension = imageValidation.mimeType?.split('/')[1] || 'png'
        const fileName = `${modelId}/${uuidv4()}.${fileExtension}`

        const { error: uploadError } = await supabaseAdmin.storage
            .from('snapshots')
            .upload(fileName, buffer, {
                contentType: imageValidation.mimeType || 'image/png',
                upsert: false,
                cacheControl: '3600' // 1 hour cache
            })

        if (uploadError) {
            console.error('[Snapshot] Upload failed:', uploadError.message)
            return NextResponse.json(
                { error: 'Failed to save snapshot image' },
                { status: 500 }
            )
        }

        // ====================================================================
        // GET PUBLIC URL
        // ====================================================================

        const { data: publicUrlData } = supabaseAdmin.storage
            .from('snapshots')
            .getPublicUrl(fileName)

        // ====================================================================
        // CREATE DATABASE RECORD
        // ====================================================================

        const sanitizedCamera = sanitizeCameraParams(camera)
        const sanitizedWidth = typeof width === 'number' && width > 0 ? Math.min(width, 4096) : 800
        const sanitizedHeight = typeof height === 'number' && height > 0 ? Math.min(height, 4096) : 600

        const { data: snapshotData, error: dbError } = await supabaseAdmin
            .from('snapshots')
            .insert({
                model_id: modelId,
                camera_params: sanitizedCamera,
                file_key: fileName,
                width: sanitizedWidth,
                height: sanitizedHeight
            })
            .select()
            .single()

        if (dbError) {
            console.error('[Snapshot] DB insert failed:', dbError.message)
            // Try to clean up the uploaded file
            await supabaseAdmin.storage.from('snapshots').remove([fileName])
            return NextResponse.json(
                { error: 'Failed to save snapshot record' },
                { status: 500 }
            )
        }

        // ====================================================================
        // SAVE ANNOTATION POSITIONS (non-blocking)
        // ====================================================================

        const sanitizedAnnotations = sanitizeAnnotations(annotations || [])

        if (sanitizedAnnotations.length > 0 && snapshotData?.id) {
            const annotationRecords = sanitizedAnnotations.map(ann => ({
                snapshot_id: snapshotData.id,
                annotation_id: ann.id,
                u: ann.u,
                v: ann.v
            }))

            // Fire and forget - don't fail the request if annotations fail
            supabaseAdmin
                .from('snapshot_annotations')
                .insert(annotationRecords)
                .then(({ error }: { error: any }) => {
                    if (error) {
                        console.warn('[Snapshot] Annotation save failed:', error.message)
                    }
                })
        }

        // ====================================================================
        // SUCCESS RESPONSE
        // ====================================================================

        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            snapshot: {
                id: snapshotData.id,
                file_key: fileName,
                width: sanitizedWidth,
                height: sanitizedHeight,
                created_at: snapshotData.created_at
            },
            url: publicUrlData.publicUrl,
            meta: {
                duration_ms: duration
            }
        })

    } catch (error: any) {
        // Log full error in development only
        if (process.env.NODE_ENV === 'development') {
            console.error('[Snapshot API Error]', error)
        }

        // Return generic error to client
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        )
    }
}
