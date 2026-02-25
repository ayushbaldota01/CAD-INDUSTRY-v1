'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProjects } from '@/hooks/useProjects'
import Button from '@/components/ui/Button'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'

function ProjectCard({ project }: { project: any }) {
    const roleVariant = project.role === 'owner' || project.role === 'admin' ? 'indigo' : 'default'

    return (
        <Link
            href={`/projects/${project.id}`}
            className="card card-interactive group rounded-xl p-5 flex flex-col gap-4 hover-lift"
        >
            <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
                {project.role && (
                    <Badge variant={roleVariant}>{project.role}</Badge>
                )}
            </div>

            <div>
                <h3 className="font-semibold text-white group-hover:text-indigo-300 transition text-base leading-snug">
                    {project.name}
                </h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                    {project.description || 'No description provided'}
                </p>
            </div>

            <p className="text-xs text-slate-600 mt-auto">
                Updated {new Date(project.updated_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                })}
            </p>
        </Link>
    )
}

export default function ProjectsPage() {
    const { projects, loading, createProject } = useProjects()
    const [showModal, setShowModal] = useState(false)
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        setError('')
        setCreating(true)
        try {
            const project = await createProject(name.trim(), desc.trim())
            setShowModal(false)
            setName('')
            setDesc('')
            if (project) router.push(`/projects/${project.id}`)
        } catch (err: any) {
            setError(err.message || 'Failed to create project')
        } finally {
            setCreating(false)
        }
    }

    const closeModal = () => {
        if (!creating) {
            setShowModal(false)
            setName('')
            setDesc('')
            setError('')
        }
    }

    return (
        <div className="min-h-screen" style={{ paddingLeft: '14rem' }}>
            <div className="max-w-6xl mx-auto px-8 py-10">

                {/* Header */}
                <header className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Organize files and collaborate with your team</p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/upload">
                            <Button variant="secondary" size="sm">
                                Quick Upload
                            </Button>
                        </Link>
                        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Project
                        </Button>
                    </div>
                </header>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Spinner size="lg" className="text-indigo-500" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="card rounded-2xl">
                        <EmptyState
                            icon="📁"
                            title="No projects yet"
                            description="Create a project to organize your CAD files and invite teammates."
                            action={
                                <Button variant="primary" onClick={() => setShowModal(true)}>
                                    Create First Project
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.map(project => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </div>

            {/* Create Project Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title="New Project"
                description="Create a project to organize your files and collaborate with your team."
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Project Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g., Engine Assembly Rev 4"
                            className="input"
                            autoFocus
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Description <span className="text-slate-600">(optional)</span>
                        </label>
                        <textarea
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            placeholder="Brief description of the project..."
                            className="input resize-none"
                            rows={3}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-3 pt-1">
                        <Button type="button" variant="ghost" onClick={closeModal} className="flex-1" disabled={creating}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" className="flex-1" loading={creating}>
                            Create Project
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
