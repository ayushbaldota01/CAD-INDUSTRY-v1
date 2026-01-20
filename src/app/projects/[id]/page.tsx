'use client'
import { use, useState, useEffect } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import TeamManagement from '@/components/TeamManagement'

// File type from database
type ProjectFile = {
    id: string
    name: string
    file_type: string
    storage_path: string
    created_at: string
    version: number
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { projects } = useProjects()
    const project = projects.find(p => p.id === id)
    const [activeTab, setActiveTab] = useState<'files' | 'team' | 'activity'>('files')
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [files, setFiles] = useState<ProjectFile[]>([])
    const [filesLoading, setFilesLoading] = useState(true)

    // Fetch files for this project
    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const { data, error } = await supabase
                    .from('files')
                    .select('*')
                    .eq('project_id', id)
                    .order('created_at', { ascending: false })

                if (error) {
                    console.error('Error fetching files:', error)
                } else {
                    setFiles(data || [])
                }
            } catch (e) {
                console.error('Failed to fetch files:', e)
            } finally {
                setFilesLoading(false)
            }
        }

        if (id) fetchFiles()
    }, [id])

    // Determine file type badge color
    const getFileTypeColor = (fileType: string) => {
        if (fileType?.includes('pdf') || fileType === 'PDF') {
            return 'bg-red-500/10 border-red-500/20 text-red-400'
        }
        return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
    }

    // Determine viewer type from file
    const getViewerType = (file: ProjectFile) => {
        const ext = file.name?.split('.').pop()?.toLowerCase() || ''
        const mimeType = file.file_type?.toLowerCase() || ''

        if (ext === 'pdf' || mimeType.includes('pdf')) return 'PDF'
        return '3D'
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <div>Loading project...</div>
                </div>
            </div>
        )
    }

    const isAdmin = project.role === 'owner' || project.role === 'admin'

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/projects" className="text-slate-400 hover:text-white transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold">{project.name}</h1>
                                <p className="text-sm text-slate-400">{project.description}</p>
                            </div>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setShowInviteModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Invite Team
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 mt-6">
                        {(['files', 'team', 'activity'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 px-1 border-b-2 transition capitalize ${activeTab === tab
                                    ? 'border-indigo-500 text-white'
                                    : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab} {tab === 'files' && files.length > 0 && <span className="ml-1 text-xs bg-slate-700 px-2 py-0.5 rounded-full">{files.length}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-8 py-8">
                {activeTab === 'files' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">Project Files</h2>
                            <Link
                                href={`/upload?project=${id}`}
                                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition"
                            >
                                Upload File
                            </Link>
                        </div>

                        {filesLoading ? (
                            <div className="text-center py-16">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-slate-400">Loading files...</p>
                            </div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
                                <p className="text-slate-400">No files in this project yet</p>
                                <p className="text-sm text-slate-500 mt-2">Upload CAD files to get started</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {files.map(file => {
                                    const viewerType = getViewerType(file)
                                    return (
                                        <Link
                                            key={file.id}
                                            href={`/view/${file.id}?name=${encodeURIComponent(file.name)}&type=${viewerType}`}
                                            className="group bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700 hover:border-indigo-500/50 p-5 transition-all duration-200"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="text-3xl">
                                                    {viewerType === 'PDF' ? '📄' : '🔷'}
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded border ${getFileTypeColor(file.file_type)}`}>
                                                    {viewerType}
                                                </span>
                                            </div>
                                            <h3 className="font-semibold text-white group-hover:text-indigo-400 transition truncate mb-1">
                                                {file.name}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                v{file.version || 1} • {new Date(file.created_at).toLocaleDateString()}
                                            </p>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'team' && (
                    <TeamManagement projectId={id} userRole={project.role || 'viewer'} />
                )}

                {activeTab === 'activity' && (
                    <div>
                        <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                            <p className="text-slate-400">Activity feed coming soon...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full border border-slate-700">
                        <h2 className="text-2xl font-bold mb-6">Invite Team Members</h2>
                        <p className="text-slate-400 mb-4">Team invitation feature coming soon...</p>
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="w-full bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
