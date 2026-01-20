'use client'

import React, { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabaseClient'
import { demoStore } from '@/lib/demoStore'

// ============================================================================
// PRODUCTION-GRADE UPLOAD PAGE
// ============================================================================
// Hardened for industry use with comprehensive error handling, validation,
// progress tracking, and user feedback.

// File size limits (must match API)
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const WARN_FILE_SIZE = 100 * 1024 * 1024 // 100MB

// Supported file types
const ACCEPTED_FILES = {
    'model/gltf-binary': ['.glb'],
    'model/stl': ['.stl'],
    'application/pdf': ['.pdf']
}

// Upload states for better UX
type UploadState = 'idle' | 'validating' | 'uploading' | 'processing' | 'success' | 'error'

interface UploadError {
    message: string
    details?: string
    recoverable: boolean
}

// Wrapper component to handle Suspense for useSearchParams
export default function UploadPageWrapper() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
                <div className="text-slate-600">Loading...</div>
            </main>
        }>
            <UploadPage />
        </Suspense>
    )
}

function UploadPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const projectId = searchParams.get('project') // Get project ID from URL

    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Get user on mount
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUserId(user?.id || null)
            setLoading(false)
        }
        getUser()
    }, [])

    // Upload state
    const [file, setFile] = useState<File | null>(null)
    const [name, setName] = useState('')
    const [uploadState, setUploadState] = useState<UploadState>('idle')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<UploadError | null>(null)
    const [warnings, setWarnings] = useState<string[]>([])

    // ========================================================================
    // FILE VALIDATION
    // ========================================================================

    const validateFile = useCallback((file: File): { valid: boolean; error?: string; warnings?: string[] } => {
        const warnings: string[] = []

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`
            }
        }

        if (file.size > WARN_FILE_SIZE) {
            warnings.push(`Large file (${(file.size / 1024 / 1024).toFixed(1)}MB). Upload may take longer.`)
        }

        // Check file type
        const ext = file.name.split('.').pop()?.toLowerCase()
        const supportedExts = ['.glb', '.stl', '.pdf']

        if (!ext || !supportedExts.some(supported => supported === `.${ext}`)) {
            return {
                valid: false,
                error: `Unsupported file type: .${ext}. Supported: GLB, STL, PDF`
            }
        }

        // Check file name
        if (file.name.length > 255) {
            return {
                valid: false,
                error: 'File name too long (max 255 characters)'
            }
        }

        // Warn about special characters
        if (/[^\w\s.-]/.test(file.name)) {
            warnings.push('File name contains special characters that may cause issues')
        }

        return { valid: true, warnings }
    }, [])

    // ========================================================================
    // DROPZONE CONFIGURATION
    // ========================================================================

    const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
        // Clear previous state
        setError(null)
        setWarnings([])

        // Handle rejected files
        if (rejectedFiles.length > 0) {
            const rejection = rejectedFiles[0]
            const errorCode = rejection.errors[0]?.code

            let errorMessage = 'File rejected'
            if (errorCode === 'file-too-large') {
                errorMessage = `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
            } else if (errorCode === 'file-invalid-type') {
                errorMessage = 'Invalid file type. Supported: GLB, STL, PDF'
            }

            setError({
                message: errorMessage,
                recoverable: true
            })
            return
        }

        if (acceptedFiles.length === 0) return

        const selectedFile = acceptedFiles[0]

        // Validate file
        const validation = validateFile(selectedFile)

        if (!validation.valid) {
            setError({
                message: validation.error || 'File validation failed',
                recoverable: true
            })
            return
        }

        // Set file and warnings
        setFile(selectedFile)
        setName(selectedFile.name)

        if (validation.warnings && validation.warnings.length > 0) {
            setWarnings(validation.warnings)
        }

    }, [validateFile])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: ACCEPTED_FILES,
        maxFiles: 1,
        maxSize: MAX_FILE_SIZE,
        multiple: false
    })

    // ========================================================================
    // UPLOAD HANDLER
    // ========================================================================

    const handleUpload = async () => {
        if (!file || uploadState === 'uploading') return

        setError(null)
        setUploadProgress(0)
        setUploadState('validating')

        try {
            // Check if demo mode
            const isDemo = !userId || process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')

            if (isDemo) {
                console.warn('[UPLOAD] Using demo mode (no database)')
                setUploadState('uploading')
                await new Promise(r => setTimeout(r, 800))
                const record = demoStore.addFile(file)
                setUploadState('success')
                router.push(`/view/${record.id}?name=${encodeURIComponent(record.name)}&type=${record.type}&local=true`)
                return
            }

            // Determine file type
            const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
            let dbType: 'glb' | 'stl' | 'pdf' = 'glb'
            if (fileExt === 'pdf') dbType = 'pdf'
            else if (fileExt === 'stl') dbType = 'stl'

            // Generate storage path: {userId}/{timestamp}_{filename}
            const storagePath = `${userId}/${Date.now()}_${file.name}`

            console.log('[UPLOAD] Starting upload', {
                fileName: file.name,
                fileSize: file.size,
                fileType: dbType,
                storagePath
            })

            // ====================================================================
            // PHASE 1: Upload to Supabase Storage
            // ====================================================================

            setUploadState('uploading')
            setUploadProgress(10)

            const { error: storageError } = await supabase.storage
                .from('cad-files')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (storageError) {
                console.error('[UPLOAD] Storage upload failed', storageError)
                throw new Error(`Storage upload failed: ${storageError.message}`)
            }

            console.log('[UPLOAD] Storage upload successful')
            setUploadProgress(50)

            // ====================================================================
            // PHASE 2: Register in Database
            // ====================================================================

            setUploadState('processing')
            setUploadProgress(60)

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name || file.name,
                    type: dbType,
                    storage_path: storagePath,
                    user_id: userId,
                    file_size: file.size,
                    project_id: projectId // Include project ID if available
                })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('[UPLOAD] Database registration failed', data)

                // Try to clean up storage
                try {
                    await supabase.storage.from('cad-files').remove([storagePath])
                    console.log('[UPLOAD] Cleaned up orphaned file from storage')
                } catch (cleanupError) {
                    console.error('[UPLOAD] Failed to cleanup storage', cleanupError)
                }

                throw new Error(data.details || data.error || 'Database registration failed')
            }

            console.log('[UPLOAD] Upload completed successfully', data)
            setUploadProgress(100)
            setUploadState('success')

            // Log warnings if any
            if (data.warnings && data.warnings.length > 0) {
                console.warn('[UPLOAD] Warnings:', data.warnings)
                setWarnings(prev => [...prev, ...data.warnings])
            }

            // Navigate to viewer
            setTimeout(() => {
                router.push(`/view/${data.file.id}?name=${encodeURIComponent(data.file.name)}&type=${dbType === 'pdf' ? 'PDF' : '3D'}`)
            }, 500)

        } catch (err: any) {
            console.error('[UPLOAD] Upload failed', err)

            setUploadState('error')
            setError({
                message: err.message || 'Upload failed',
                details: err.stack,
                recoverable: true
            })
        }
    }

    // ========================================================================
    // RETRY HANDLER
    // ========================================================================

    const handleRetry = () => {
        setError(null)
        setUploadState('idle')
        setUploadProgress(0)
    }

    // ========================================================================
    // LOADING STATE
    // ========================================================================

    if (loading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
                <div className="text-slate-600">Loading...</div>
            </main>
        )
    }

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Upload CAD File</h1>
                        <p className="text-slate-600 mt-1">GLB, STL, or PDF formats supported</p>
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 transition"
                    >
                        ← Back
                    </button>
                </div>

                {/* Main Upload Card */}
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    {/* Dropzone */}
                    <div
                        {...getRootProps()}
                        className={`
                            p-12 border-2 border-dashed rounded-t-xl transition-all cursor-pointer
                            ${isDragActive
                                ? 'border-indigo-500 bg-indigo-50'
                                : file
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50'
                            }
                        `}
                    >
                        <input {...getInputProps()} />
                        <div className="text-center">
                            <div className="text-6xl mb-4">
                                {file ? '✅' : isDragActive ? '📥' : '📁'}
                            </div>
                            {file ? (
                                <>
                                    <p className="text-lg font-semibold text-green-700 mb-1">{file.name}</p>
                                    <p className="text-sm text-green-600">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-lg font-semibold text-slate-700 mb-2">
                                        {isDragActive ? 'Drop file here' : 'Drag & drop a file here'}
                                    </p>
                                    <p className="text-sm text-slate-500">or click to browse</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* File Details */}
                    {file && (
                        <div className="p-6 bg-slate-50 border-t border-slate-200">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Display Name (optional)
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={file.name}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                            />
                        </div>
                    )}

                    {/* Warnings */}
                    {warnings.length > 0 && (
                        <div className="p-4 bg-yellow-50 border-t border-yellow-200">
                            <div className="flex items-start gap-3">
                                <div className="text-yellow-600 text-xl">⚠️</div>
                                <div className="flex-1">
                                    <p className="font-medium text-yellow-800 mb-1">Warnings:</p>
                                    <ul className="text-sm text-yellow-700 space-y-1">
                                        {warnings.map((warning, i) => (
                                            <li key={i}>• {warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="p-4 bg-red-50 border-t border-red-200">
                            <div className="flex items-start gap-3">
                                <div className="text-red-600 text-xl">❌</div>
                                <div className="flex-1">
                                    <p className="font-medium text-red-800 mb-1">{error.message}</p>
                                    {error.details && process.env.NODE_ENV === 'development' && (
                                        <p className="text-xs text-red-600 mt-2 font-mono">{error.details}</p>
                                    )}
                                    {error.recoverable && (
                                        <button
                                            onClick={handleRetry}
                                            className="mt-3 text-sm text-red-700 hover:text-red-800 font-medium underline"
                                        >
                                            Try Again
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar */}
                    {uploadState !== 'idle' && uploadState !== 'error' && (
                        <div className="p-4 bg-indigo-50 border-t border-indigo-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-indigo-700">
                                    {uploadState === 'validating' && '🔍 Validating...'}
                                    {uploadState === 'uploading' && '📤 Uploading...'}
                                    {uploadState === 'processing' && '⚙️ Processing...'}
                                    {uploadState === 'success' && '✅ Complete!'}
                                </span>
                                <span className="text-sm text-indigo-600">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-indigo-600 h-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="p-6 bg-white border-t border-slate-200 flex gap-3">
                        <button
                            onClick={handleUpload}
                            disabled={!file || uploadState === 'uploading' || uploadState === 'processing'}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition shadow-lg shadow-indigo-900/20"
                        >
                            {uploadState === 'uploading' || uploadState === 'processing' ? 'Uploading...' : 'Upload File'}
                        </button>
                        {file && uploadState === 'idle' && (
                            <button
                                onClick={() => {
                                    setFile(null)
                                    setName('')
                                    setWarnings([])
                                }}
                                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <div className="text-blue-600 text-xl">ℹ️</div>
                        <div className="flex-1 text-sm text-blue-800">
                            <p className="font-medium mb-1">Supported Formats:</p>
                            <ul className="space-y-1">
                                <li>• <strong>GLB</strong> - 3D models (recommended)</li>
                                <li>• <strong>STL</strong> - 3D meshes</li>
                                <li>• <strong>PDF</strong> - 2D drawings</li>
                            </ul>
                            <p className="mt-2 text-xs text-blue-600">Maximum file size: 500MB</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
