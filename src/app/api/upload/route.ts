
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ============================================================================
// PRODUCTION-GRADE UPLOAD API
// ============================================================================
// This handler is designed for industry use with comprehensive validation,
// error handling, logging, and failure recovery.

// Supported file types (must match database enum)
const SUPPORTED_FILE_TYPES = ['glb', 'stl', 'pdf'] as const
type SupportedFileType = typeof SUPPORTED_FILE_TYPES[number]

// File size limits (in bytes)
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const WARN_FILE_SIZE = 100 * 1024 * 1024 // 100MB (log warning)

// Validation result type
interface ValidationResult {
    valid: boolean
    error?: string
    warnings?: string[]
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates file name for safety and compatibility
 */
function validateFileName(name: string): ValidationResult {
    const warnings: string[] = []

    // Check for empty name
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'File name cannot be empty' }
    }

    // Check length
    if (name.length > 255) {
        return { valid: false, error: 'File name too long (max 255 characters)' }
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1F]/g
    if (dangerousChars.test(name)) {
        return { valid: false, error: 'File name contains invalid characters' }
    }

    // Warn about special characters
    if (/[^\w\s.-]/.test(name)) {
        warnings.push('File name contains special characters that may cause issues')
    }

    // Check for file extension
    if (!name.includes('.')) {
        warnings.push('File name has no extension')
    }

    return { valid: true, warnings }
}

/**
 * Validates file type against supported formats
 */
function validateFileType(type: string): ValidationResult {
    if (!type) {
        return { valid: false, error: 'File type is required' }
    }

    const normalizedType = type.toLowerCase()

    if (!SUPPORTED_FILE_TYPES.includes(normalizedType as SupportedFileType)) {
        return {
            valid: false,
            error: `Unsupported file type: ${type}. Supported: ${SUPPORTED_FILE_TYPES.join(', ')}`
        }
    }

    return { valid: true }
}

/**
 * Validates storage path format
 */
function validateStoragePath(path: string): ValidationResult {
    if (!path || path.trim().length === 0) {
        return { valid: false, error: 'Storage path is required' }
    }

    // Check for path traversal attempts
    if (path.includes('..') || path.includes('//')) {
        return { valid: false, error: 'Invalid storage path format' }
    }

    // Ensure path doesn't start with /
    if (path.startsWith('/')) {
        return { valid: false, error: 'Storage path should not start with /' }
    }

    return { valid: true }
}

/**
 * Validates user ID format
 */
function validateUserId(userId: string): ValidationResult {
    if (!userId || userId.trim().length === 0) {
        return { valid: false, error: 'User ID is required' }
    }

    // Allow mock user IDs for testing
    if (userId.startsWith('mock-')) {
        return { valid: true }
    }

    // UUID format check (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
        return { valid: false, error: 'Invalid user ID format' }
    }

    return { valid: true }
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Structured logging for upload operations
 */
function logUpload(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logEntry = {
        timestamp,
        level,
        service: 'upload-api',
        message,
        ...data
    }

    if (level === 'error') {
        console.error('[UPLOAD ERROR]', JSON.stringify(logEntry, null, 2))
    } else if (level === 'warn') {
        console.warn('[UPLOAD WARN]', JSON.stringify(logEntry, null, 2))
    } else {
        console.log('[UPLOAD INFO]', JSON.stringify(logEntry, null, 2))
    }
}

// ============================================================================
// MAIN UPLOAD HANDLER
// ============================================================================

export async function POST(req: Request) {
    const startTime = Date.now()
    let uploadId: string | null = null

    try {
        // Parse request body
        const body = await req.json()
        const { name, type, storage_path, user_id, file_size, project_id } = body

        // Generate upload ID for tracking
        uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        logUpload('info', 'Upload request received', {
            uploadId,
            name,
            type,
            user_id,
            file_size,
            project_id
        })

        // ========================================================================
        // VALIDATION PHASE
        // ========================================================================

        const validations = [
            { name: 'fileName', result: validateFileName(name) },
            { name: 'fileType', result: validateFileType(type) },
            { name: 'storagePath', result: validateStoragePath(storage_path) },
            { name: 'userId', result: validateUserId(user_id) }
        ]

        // Check for validation errors
        const errors = validations.filter(v => !v.result.valid)
        if (errors.length > 0) {
            const errorMessages = errors.map(e => `${e.name}: ${e.result.error}`).join('; ')
            logUpload('error', 'Validation failed', { uploadId, errors: errorMessages })
            return NextResponse.json(
                { error: 'Validation failed', details: errorMessages },
                { status: 400 }
            )
        }

        // Collect warnings
        const allWarnings = validations
            .flatMap(v => v.result.warnings || [])
            .filter(Boolean)

        if (allWarnings.length > 0) {
            logUpload('warn', 'Validation warnings', { uploadId, warnings: allWarnings })
        }

        // File size validation
        if (file_size) {
            if (file_size > MAX_FILE_SIZE) {
                logUpload('error', 'File too large', { uploadId, file_size, max: MAX_FILE_SIZE })
                return NextResponse.json(
                    { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                    { status: 413 }
                )
            }

            if (file_size > WARN_FILE_SIZE) {
                logUpload('warn', 'Large file upload', { uploadId, file_size })
            }
        }

        // ========================================================================
        // VERSION CALCULATION
        // ========================================================================

        logUpload('info', 'Checking for existing versions', { uploadId, name, user_id })

        const { data: existingFiles, error: fetchError } = await supabaseAdmin
            .from('files')
            .select('version')
            .eq('name', name)
            .eq('created_by', user_id)
            .order('version', { ascending: false })
            .limit(1)

        if (fetchError) {
            logUpload('error', 'Database query failed (version check)', {
                uploadId,
                error: fetchError.message,
                code: fetchError.code
            })
            return NextResponse.json(
                { error: 'Failed to check existing versions', details: fetchError.message },
                { status: 500 }
            )
        }

        const nextVersion = existingFiles && existingFiles.length > 0
            ? existingFiles[0].version + 1
            : 1

        logUpload('info', 'Version calculated', { uploadId, nextVersion, isNewFile: nextVersion === 1 })

        // ========================================================================
        // DATABASE INSERTION
        // ========================================================================

        logUpload('info', 'Inserting file record', { uploadId, version: nextVersion, project_id })

        // Build insert object - only include project_id if provided
        const insertData: Record<string, any> = {
            name,
            type: type.toLowerCase(), // Normalize to lowercase
            storage_path,
            version: nextVersion,
            created_by: user_id
        }

        // Add project_id if provided (for project-associated uploads)
        if (project_id) {
            insertData.project_id = project_id
        }

        const { data: fileRecord, error: insertError } = await supabaseAdmin
            .from('files')
            .insert(insertData)
            .select()
            .single()

        if (insertError) {
            logUpload('error', 'Database insertion failed', {
                uploadId,
                error: insertError.message,
                code: insertError.code,
                hint: insertError.hint
            })

            // Provide specific error messages for common issues
            if (insertError.code === '23505') { // Unique violation
                return NextResponse.json(
                    { error: 'File with this name and version already exists' },
                    { status: 409 }
                )
            }

            if (insertError.code === '23503') { // Foreign key violation
                return NextResponse.json(
                    { error: 'Invalid user ID or reference' },
                    { status: 400 }
                )
            }

            return NextResponse.json(
                { error: 'Failed to save file record', details: insertError.message },
                { status: 500 }
            )
        }

        // ========================================================================
        // ACTIVITY LOGGING
        // ========================================================================

        const activityAction = nextVersion > 1 ? 'version_created' : 'file_uploaded'

        logUpload('info', 'Logging activity', { uploadId, action: activityAction, fileId: fileRecord.id })

        const { error: activityError } = await supabaseAdmin
            .from('activity_logs')
            .insert({
                file_id: fileRecord.id,
                action: activityAction,
                user_id: user_id
            })

        // Activity logging is non-critical - log error but don't fail the upload
        if (activityError) {
            logUpload('warn', 'Activity logging failed (non-critical)', {
                uploadId,
                error: activityError.message
            })
        }

        // ========================================================================
        // SUCCESS RESPONSE
        // ========================================================================

        const duration = Date.now() - startTime

        logUpload('info', 'Upload completed successfully', {
            uploadId,
            fileId: fileRecord.id,
            version: nextVersion,
            duration_ms: duration
        })

        return NextResponse.json({
            success: true,
            file: fileRecord,
            uploadId,
            warnings: allWarnings.length > 0 ? allWarnings : undefined
        })

    } catch (e: any) {
        // ========================================================================
        // GLOBAL ERROR HANDLER
        // ========================================================================

        const duration = Date.now() - startTime

        logUpload('error', 'Unexpected error in upload handler', {
            uploadId,
            error: e.message,
            stack: e.stack,
            duration_ms: duration
        })

        // Don't expose internal errors to client
        return NextResponse.json(
            {
                error: 'An unexpected error occurred during upload',
                uploadId,
                message: process.env.NODE_ENV === 'development' ? e.message : undefined
            },
            { status: 500 }
        )
    }
}
