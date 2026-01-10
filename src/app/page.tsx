'use client'

/**
 * Dashboard Page - Optimized
 * 
 * Main landing page with improved performance and offline support.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase, isOfflineMode, checkSupabaseConnection } from '@/lib/supabaseClient'

type FileRecord = {
  id: string
  name: string
  file_type: string
  created_at: string
}

export default function Home() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // Check connection and auth on mount
  useEffect(() => {
    const init = async () => {
      // Check if we're online
      if (isOfflineMode) {
        setConnectionStatus('offline')
      } else {
        const isOnline = await checkSupabaseConnection()
        setConnectionStatus(isOnline ? 'online' : 'offline')
      }

      // Get session
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)
    }

    init()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch files when session is available
  const fetchFiles = useCallback(async () => {
    if (!session || connectionStatus === 'offline') {
      setFiles([])
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('files')
        .select('id, name, file_type, created_at')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setFiles(data)
      }
    } catch (e) {
      console.warn('Failed to fetch files:', e)
    }

    setLoading(false)
  }, [session, connectionStatus])

  useEffect(() => {
    if (session && connectionStatus === 'online') {
      fetchFiles()
    }
  }, [session, connectionStatus, fetchFiles])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">CAD Review Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage 3D models and specifications</p>
          </div>

          <div className="flex gap-4 items-center">
            {/* Connection Status */}
            {connectionStatus === 'offline' && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                Local Mode
              </div>
            )}

            {session ? (
              <div className="text-sm text-slate-600">
                <span className="font-semibold">{session.user.email}</span>
              </div>
            ) : (
              <Link href="/login" className="text-indigo-600 font-medium hover:underline">
                Log In
              </Link>
            )}

            <Link
              href="/upload"
              className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
            >
              <span>+</span> Upload Asset
            </Link>
          </div>
        </header>

        {/* Quick Stats */}
        {session && connectionStatus === 'online' && files.length > 0 && (
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-3xl font-bold text-indigo-600">{files.length}</div>
              <div className="text-sm text-slate-500 mt-1">Recent Files</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-3xl font-bold text-emerald-600">
                {files.filter(f => ['glb', 'gltf', 'stl', 'obj'].includes(f.file_type)).length}
              </div>
              <div className="text-sm text-slate-500 mt-1">3D Models</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-3xl font-bold text-rose-600">
                {files.filter(f => f.file_type === 'pdf').length}
              </div>
              <div className="text-sm text-slate-500 mt-1">Documents</div>
            </div>
          </div>
        )}

        {/* Files Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Recent Files</h2>
            {session && connectionStatus === 'online' && (
              <button
                onClick={fetchFiles}
                className="text-sm text-indigo-600 font-medium hover:underline"
              >
                Refresh
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {loading && (
              <div className="p-8 text-center text-slate-400">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading...
              </div>
            )}

            {!loading && !session && (
              <div className="p-12 text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sign in to view your files</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Access your CAD models, collaborate with your team, and manage projects.
                </p>
                <Link
                  href="/login"
                  className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
                >
                  Sign In
                </Link>
              </div>
            )}

            {!loading && session && connectionStatus === 'offline' && (
              <div className="p-12 text-center">
                <div className="text-5xl mb-4">📴</div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Offline Mode</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  You can still upload and view files locally. They will sync when connection is restored.
                </p>
                <Link
                  href="/upload"
                  className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
                >
                  Upload Local File
                </Link>
              </div>
            )}

            {!loading && session && connectionStatus === 'online' && files.length === 0 && (
              <div className="p-12 text-center">
                <div className="text-5xl mb-4">📁</div>
                <p className="text-slate-500 mb-4">No files yet.</p>
                <Link href="/upload" className="text-indigo-600 hover:underline">
                  Upload your first model
                </Link>
              </div>
            )}

            {!loading && files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center justify-between p-4 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-4">
                  <div className={`
                                        w-12 h-12 rounded-lg flex items-center justify-center text-xl shadow-sm
                                        ${['glb', 'gltf', 'stl', 'obj'].includes(file.file_type)
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-red-50 text-red-600'
                    }
                                    `}>
                    {['glb', 'gltf', 'stl', 'obj'].includes(file.file_type) ? '🎲' : '📄'}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 group-hover:text-indigo-600 transition">
                      {file.name}
                    </h3>
                    <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                      <span>{new Date(file.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span className="uppercase">{file.file_type}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/view/${file.id}?name=${encodeURIComponent(file.name)}&type=${file.file_type === 'pdf' ? 'PDF' : '3D'}`}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
