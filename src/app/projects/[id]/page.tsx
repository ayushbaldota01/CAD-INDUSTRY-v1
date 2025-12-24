'use client'
import { use, useState } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import TeamManagement from '@/components/TeamManagement'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const { projects } = useProjects()
    const project = projects.find(p => p.id === id)
    const [activeTab, setActiveTab] = useState<'files' | 'team' | 'activity'>('files')
    const [showInviteModal, setShowInviteModal] = useState(false)

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <div>Loading project...</div>
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
                                {tab}
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
                                href="/upload"
                                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition"
                            >
                                Upload File
                            </Link>
                        </div>
                        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
                            <p className="text-slate-400">No files in this project yet</p>
                            <p className="text-sm text-slate-500 mt-2">Upload CAD files to get started</p>
                        </div>
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
