'use client'
import { useProjects } from '@/hooks/useProjects'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type UserFile = {
    id: string
    name: string
    type: string
    created_at: string
    project_id: string | null
}

export default function ProjectsPage() {
    const { projects, loading, createProject } = useProjects()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [newProjectDesc, setNewProjectDesc] = useState('')
    const [creating, setCreating] = useState(false)
    const router = useRouter()

    // Fetch all user's files (including those not in any project)
    const [allFiles, setAllFiles] = useState<UserFile[]>([])
    const [filesLoading, setFilesLoading] = useState(true)

    useEffect(() => {
        const fetchAllFiles = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setFilesLoading(false)
                    return
                }

                const { data, error } = await supabase
                    .from('files')
                    .select('id, name, type, created_at, project_id')
                    .eq('created_by', user.id)
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (!error && data) {
                    setAllFiles(data)
                }
            } catch (e) {
                console.error('Failed to fetch files:', e)
            } finally {
                setFilesLoading(false)
            }
        }

        fetchAllFiles()
    }, [])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        try {
            const project = await createProject(newProjectName, newProjectDesc)
            setShowCreateModal(false)
            setNewProjectName('')
            setNewProjectDesc('')
            if (project) {
                router.push(`/projects/${project.id}`)
            }
        } catch (err) {
            alert('Failed to create project')
        } finally {
            setCreating(false)
        }
    }

    // Helper to get viewer type
    const getViewerType = (file: UserFile) => {
        if (file.type === 'pdf' || file.name?.toLowerCase().endsWith('.pdf')) return 'PDF'
        return '3D'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white">Loading projects...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Projects</h1>
                        <p className="text-slate-400">Manage your team's CAD projects</p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/upload"
                            className="bg-slate-700 hover:bg-slate-600 px-4 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Quick Upload
                        </Link>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Project
                        </button>
                    </div>
                </div>

                {/* Recent Files Section */}
                {allFiles.length > 0 && (
                    <div className="mb-10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Recent Files</h2>
                            <span className="text-sm text-slate-400">{allFiles.length} file{allFiles.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {allFiles.slice(0, 10).map(file => {
                                const viewerType = getViewerType(file)
                                return (
                                    <Link
                                        key={file.id}
                                        href={`/view/${file.id}?name=${encodeURIComponent(file.name)}&type=${viewerType}`}
                                        className="group bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700 hover:border-indigo-500/50 p-4 transition-all"
                                    >
                                        <div className="text-2xl mb-2">
                                            {viewerType === 'PDF' ? '📄' : '🔷'}
                                        </div>
                                        <h3 className="font-medium text-sm text-white group-hover:text-indigo-400 transition truncate mb-1">
                                            {file.name}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            {new Date(file.created_at).toLocaleDateString()}
                                        </p>
                                        {!file.project_id && (
                                            <span className="inline-block mt-2 text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">
                                                No project
                                            </span>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Projects Section */}
                <h2 className="text-xl font-semibold mb-4">Your Projects</h2>

                {projects.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700">
                        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
                        <p className="text-slate-400 mb-6">Create your first project to organize files</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-lg font-semibold transition"
                        >
                            Create Project
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-indigo-500 transition group"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-600/30 transition">
                                        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs bg-slate-700 px-2 py-1 rounded capitalize">{project.role}</span>
                                </div>
                                <h3 className="text-lg font-semibold mb-2 group-hover:text-indigo-400 transition">{project.name}</h3>
                                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{project.description || 'No description'}</p>
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full border border-slate-700">
                        <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Project Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g., Building Design 2024"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Description (optional)</label>
                                <textarea
                                    value={newProjectDesc}
                                    onChange={e => setNewProjectDesc(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    rows={3}
                                    placeholder="Brief description of the project..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 py-3 rounded-lg font-semibold transition"
                                >
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
