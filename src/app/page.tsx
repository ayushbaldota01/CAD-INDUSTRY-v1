'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase, isOfflineMode, checkSupabaseConnection } from '@/lib/supabaseClient'
import { getFileDisplayType, type FileRecord } from '@/types'
import Badge from '@/components/ui/Badge'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import Button from '@/components/ui/Button'

type Stats = { total: number; models: number; docs: number }

function FileCard({ file }: { file: FileRecord }) {
  const displayType = getFileDisplayType(file)
  const is3D = displayType === '3D'

  return (
    <Link
      href={`/view/${file.id}?name=${encodeURIComponent(file.name)}&type=${displayType}`}
      className="card card-interactive group p-4 flex flex-col gap-3 rounded-xl hover-lift animate-fade-up"
    >
      {/* Icon + Type */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${is3D ? 'bg-indigo-500/10' : 'bg-red-500/10'
          }`}>
          {is3D ? '🔷' : '📄'}
        </div>
        <Badge variant={is3D ? 'indigo' : 'red'}>
          {is3D ? '3D' : 'PDF'}
        </Badge>
      </div>

      {/* Name */}
      <div>
        <h3 className="font-medium text-white text-sm leading-tight group-hover:text-indigo-300 transition truncate">
          {file.name}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {new Date(file.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          })}
        </p>
      </div>
    </Link>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card rounded-xl p-5">
      <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">{label}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, models: 0, docs: 0 })
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Connection check
  useEffect(() => {
    if (isOfflineMode) { setStatus('offline'); return }
    checkSupabaseConnection().then(online => setStatus(online ? 'online' : 'offline'))
  }, [])

  // Fetch files
  const fetchFiles = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('files')
        .select('id, name, type, storage_path, project_id, created_by, created_at')
        .order('created_at', { ascending: false })
        .limit(24)

      if (error) throw error

      if (data) {
        // Map DB type to our type if needed, but now they match
        const records = data as unknown as FileRecord[]
        setFiles(records)
        setStats({
          total: records.length,
          models: records.filter(f => getFileDisplayType(f) === '3D').length,
          docs: records.filter(f => getFileDisplayType(f) === 'PDF').length,
        })
      }
    } catch (e) {
      console.warn('Failed to fetch files:', e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) fetchFiles()
  }, [session, fetchFiles])

  return (
    <div className="min-h-screen" style={{ paddingLeft: '14rem' }}>
      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Your recent CAD files and models</p>
          </div>
          <div className="flex items-center gap-3">
            {status === 'offline' && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/8 border border-amber-500/15 px-3 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Local Mode
              </div>
            )}
            {session && !loading && (
              <button
                onClick={fetchFiles}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                ↺ Refresh
              </button>
            )}
            <Link href="/upload">
              <Button variant="primary" size="sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload File
              </Button>
            </Link>
          </div>
        </header>

        {/* Stats — only when we have data */}
        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard label="Total Files" value={stats.total} color="text-white" />
            <StatCard label="3D Models" value={stats.models} color="text-indigo-400" />
            <StatCard label="Documents" value={stats.docs} color="text-red-400" />
          </div>
        )}

        {/* Files Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Files</h2>
            {files.length > 0 && (
              <Link href="/projects" className="text-xs text-indigo-400 hover:text-indigo-300 transition">
                View all projects →
              </Link>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" className="text-indigo-500" />
            </div>
          )}

          {/* Not signed in */}
          {!loading && !session && (
            <div className="card rounded-2xl">
              <EmptyState
                icon="🔐"
                title="Sign in to view your files"
                description="Access your CAD models, collaborate with your team, and manage design reviews."
                action={
                  <Link href="/login">
                    <Button variant="primary">Sign In</Button>
                  </Link>
                }
              />
            </div>
          )}

          {/* Offline */}
          {!loading && session && status === 'offline' && (
            <div className="card rounded-2xl">
              <EmptyState
                icon="📴"
                title="You're offline"
                description="Reconnect to sync your files. You can still upload and view local files."
                action={
                  <Link href="/upload">
                    <Button variant="primary">Upload Local File</Button>
                  </Link>
                }
              />
            </div>
          )}

          {/* No files */}
          {!loading && session && files.length === 0 && (
            <div className="card rounded-2xl">
              <EmptyState
                icon="📁"
                title="No files yet"
                description="Upload your first 3D model or PDF drawing to get started."
                action={
                  <Link href="/upload">
                    <Button variant="primary">Upload Your First File</Button>
                  </Link>
                }
              />
            </div>
          )}

          {/* Files grid */}
          {!loading && files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {files.map(file => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
