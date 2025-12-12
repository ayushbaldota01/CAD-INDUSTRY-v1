
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { supabase } from '@/lib/supabaseClient'
import { demoStore } from '@/lib/demoStore'

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null)
    const [name, setName] = useState('')
    const [uploading, setUploading] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setUserId(user.id)
        } else {
            const mock = localStorage.getItem('cad-viewer-demo-user')
            if (mock) {
                const u = JSON.parse(mock)
                setUserId(u.id)
            }
        }
    }

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length > 0) {
            const f = acceptedFiles[0]
            setFile(f)
            setName(f.name.split('.')[0])
        }
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'model/gltf-binary': ['.glb'],
            'model/gltf+json': ['.gltf'],
            'model/stl': ['.stl'],
            'model/obj': ['.obj'],
            'application/pdf': ['.pdf'],
            'application/octet-stream': ['.step', '.stp', '.sldprt', '.sldasm']
        },
        maxFiles: 1
    })

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)

        try {
            const isDemo = !userId || process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')

            if (isDemo) {
                console.warn('Using Local Demo Store')
                await new Promise(r => setTimeout(r, 800))
                const record = demoStore.addFile(file)
                router.push(`/view/${record.id}?name=${encodeURIComponent(record.name)}&type=${record.type}&local=true`)
                return
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `${userId}/${Date.now()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('models').upload(fileName, file)
            if (uploadError) throw uploadError

            const { data, error: dbError } = await supabase.from('models').insert({
                owner_id: userId,
                name: name || file.name,
                storage_key: fileName,
                file_type: fileExt,
                width: 0,
                height: 0
            }).select().single()

            if (dbError) throw dbError
            if (data) router.push(`/view/${data.id}?name=${encodeURIComponent(data.name)}`)

        } catch (error: any) {
            console.error('Upload failed:', error)
            if (confirm('Upload failed (DB might be missing). Load locally for viewing only?')) {
                const record = demoStore.addFile(file)
                router.push(`/view/${record.id}?name=${encodeURIComponent(record.name)}&type=${record.type === '3D' ? '3D' : 'PDF'}&local=true`)
            }
        } finally {
            setUploading(false)
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
            <div className="w-full max-w-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Upload Asset</h1>
                    <Link href="/" className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition flex items-center gap-1">
                        ← Back to Dashboard
                    </Link>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-8 space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Project Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Prototype V1"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-none"
                            />
                        </div>

                        <div
                            {...getRootProps()}
                            className={`relative border-4 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                        >
                            <input {...getInputProps()} />
                            <div className="space-y-4 pointer-events-none">
                                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl transition-colors ${file ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {file ? '📄' : '☁️'}
                                </div>
                                {file ? (
                                    <div>
                                        <p className="font-semibold text-slate-900 text-lg">{file.name}</p>
                                        <p className="text-slate-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-semibold text-slate-900 text-lg">Drop your file here</p>
                                        <p className="text-slate-500 text-sm">Supports GLB, GLTF, STL, OBJ, PDF, STEP, SLDPRT, SLDASM</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className={`w-full py-4 px-6 rounded-xl font-bold text-white text-lg shadow-lg tracking-wide transition-all ${!file || uploading ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/25 active:scale-[0.98]'}`}
                        >
                            {uploading ? 'Processing...' : 'Launch Viewer'}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}
