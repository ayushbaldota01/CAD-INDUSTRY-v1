'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { supabase } from '@/lib/supabaseClient'
import { useActivityLog, type ActivityLog } from '@/hooks/useActivityLog'
import Link from 'next/link'
import TeamManagement from '@/components/TeamManagement'
import { Spinner } from '@/components/ui/Feedback'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'

type ProjectFile = {
    id: string
    name: string
    type: string
    storage_path: string
    created_at: string
    version: number
}

function FileGrid({ projectId }: { projectId: string }) {
    const [files, setFiles] = useState<ProjectFile[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        supabase
            .from('files')
            .select('id, name, type, storage_path, created_at, version')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setFiles(data as ProjectFile[])
                setLoading(false)
            })
    }, [projectId])

    const getViewerType = (file: ProjectFile) => {
        const ext = file.name?.split('.').pop()?.toLowerCase() || ''
        const mime = file.type?.toLowerCase() || ''
        return ext === 'pdf' || mime.includes('pdf') ? 'PDF' : '3D'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" className="text-indigo-500" />
            </div>
        )
    }

    if (files.length === 0) {
        return (
            <div className="card rounded-2xl text-center py-16">
                <div className="text-4xl mb-4">📁</div>
                <h3 className="text-white font-semibold text-lg mb-2">No files yet</h3>
                <p className="text-slate-500 text-sm mb-6">Upload CAD files or engineering drawings to get started.</p>
                <Link href={`/upload?project=${projectId}`}>
                    <Button variant="primary" size="sm">Upload First File</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map(file => {
                const type = getViewerType(file)
                return (
                    <Link
                        key={file.id}
                        href={`/view/${file.id}?name=${encodeURIComponent(file.name)}&type=${type}`}
                        className="card card-interactive group rounded-xl p-5 hover-lift"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${type === 'PDF' ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}>
                                {type === 'PDF' ? '📄' : '🔷'}
                            </div>
                            <Badge variant={type === 'PDF' ? 'red' : 'indigo'}>{type}</Badge>
                        </div>
                        <h3 className="font-semibold text-white group-hover:text-indigo-300 transition truncate mb-1">
                            {file.name}
                        </h3>
                        <p className="text-xs text-slate-600">
                            v{file.version || 1} · {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    </Link>
                )
            })}
        </div>
    )
}

// Action verb → human-readable label
const ACTION_MAP: Record<string, string> = {
    annotation_added: 'added an annotation',
    annotation_resolved: 'resolved an annotation',
    annotation_deleted: 'deleted an annotation',
    snapshot_created: 'took a snapshot',
    file_exported_step: 'exported as STEP',
    file_exported_glb: 'exported as GLB',
    file_exported_pdf: 'exported as PDF',
    file_opened: 'opened the file',
    file_uploaded: 'uploaded a file',
}

function ActivityFeed({ projectId }: { projectId: string }) {
    // We pass undefined as fileId to get project-level activity
    // The hook fetches for a single file – for project-level we do our own query
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            // Get all files for this project first, then fetch activity for all
            const { data: fileRows } = await supabase
                .from('files')
                .select('id')
                .eq('project_id', projectId)

            if (!fileRows || fileRows.length === 0) { setLoading(false); return }

            const fileIds = fileRows.map(f => f.id)

            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .in('file_id', fileIds)
                .order('created_at', { ascending: false })
                .limit(40)

            if (!error && data) setLogs(data as ActivityLog[])
        } catch (e) {
            console.warn('Activity feed failed:', e)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <Spinner size="md" className="text-indigo-500" />
        </div>
    )

    if (logs.length === 0) return (
        <div className="card rounded-2xl text-center py-16">
            <div className="text-4xl mb-4">🕐</div>
            <h3 className="text-white font-semibold mb-2">No activity yet</h3>
            <p className="text-slate-500 text-sm">Actions like annotations, snapshots, and file exports will appear here.</p>
        </div>
    )

    return (
        <div className="space-y-1">
            {logs.map((log, i) => {
                const label = ACTION_MAP[log.action] || log.action.replace(/_/g, ' ')
                const time = new Date(log.created_at)
                const isToday = new Date().toDateString() === time.toDateString()
                const timeStr = isToday
                    ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                return (
                    <div key={log.id} className="flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-0">
                        {/* Timeline dot */}
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500/60 mt-2" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-300">
                                <span className="font-medium text-white">
                                    {log.user_name || 'A user'}
                                </span>{' '}
                                {label}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">{timeStr}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { projects } = useProjects()
    const project = projects.find(p => p.id === id)
    const [activeTab, setActiveTab] = useState<'files' | 'team' | 'activity'>('files')

    // Loading skeleton while projects hook resolves
    if (!project) {
        return (
            <div className="min-h-screen" style={{ paddingLeft: '14rem' }}>
                <div className="flex items-center justify-center h-screen">
                    <Spinner size="lg" className="text-indigo-500" />
                </div>
            </div>
        )
    }

    const isAdmin = project.role === 'owner' || project.role === 'admin'
    const tabs = [
        { key: 'files', label: 'Files' },
        { key: 'team', label: 'Team' },
        { key: 'activity', label: 'Activity' },
    ] as const

    return (
        <div className="min-h-screen" style={{ paddingLeft: '14rem' }}>
            {/* Sticky Header */}
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-8 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/projects" className="text-slate-500 hover:text-white transition p-1 -ml-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-white leading-tight">{project.name}</h1>
                                {project.description && (
                                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{project.description}</p>
                                )}
                            </div>
                            {project.role && (
                                <Badge variant={isAdmin ? 'indigo' : 'default'}>
                                    {project.role}
                                </Badge>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Link href={`/upload?project=${id}`}>
                                <Button variant="secondary" size="sm">Upload File</Button>
                            </Link>
                        </div>
                    </div>

                    {/* Tabs */}
                    <nav className="flex gap-6 mt-5">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`pb-3 px-1 text-sm font-medium border-b-2 transition capitalize ${activeTab === tab.key
                                    ? 'border-indigo-500 text-white'
                                    : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </header>

            {/* Tab Content */}
            <main className="max-w-6xl mx-auto px-8 py-8">
                {activeTab === 'files' && <FileGrid projectId={id} />}

                {activeTab === 'team' && (
                    <TeamManagement projectId={id} userRole={project.role || 'viewer'} />
                )}

                {activeTab === 'activity' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                        </div>
                        <div className="card rounded-2xl p-6">
                            <ActivityFeed projectId={id} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
