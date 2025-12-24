'use client'
import { useState } from 'react'
import { useProjectMembers } from '@/hooks/useProjectMembers'

type TeamManagementProps = {
    projectId: string
    userRole: string
}

export default function TeamManagement({ projectId, userRole }: TeamManagementProps) {
    const { members, loading, addMember, updateMemberRole, removeMember } = useProjectMembers(projectId)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
    const [inviting, setInviting] = useState(false)
    const [error, setError] = useState('')

    const isAdmin = userRole === 'owner' || userRole === 'admin'

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setInviting(true)
        setError('')

        try {
            await addMember(inviteEmail, inviteRole)
            setShowInviteModal(false)
            setInviteEmail('')
            setInviteRole('member')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setInviting(false)
        }
    }

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'member' | 'viewer') => {
        try {
            await updateMemberRole(userId, newRole)
        } catch (err) {
            alert('Failed to update role')
        }
    }

    const handleRemove = async (userId: string) => {
        if (!confirm('Remove this member from the project?')) return

        try {
            await removeMember(userId)
        } catch (err) {
            alert('Failed to remove member')
        }
    }

    if (loading) {
        return <div className="text-slate-400">Loading team members...</div>
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Team Members ({members.length})</h2>
                {isAdmin && (
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Add Member
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {members.map(member => (
                    <div
                        key={member.user_id}
                        className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-600/20 rounded-full flex items-center justify-center">
                                <span className="text-indigo-400 font-semibold">
                                    {member.profile?.full_name?.charAt(0) || member.profile?.email?.charAt(0) || '?'}
                                </span>
                            </div>
                            <div>
                                <p className="font-medium">{member.profile?.full_name || 'Unknown User'}</p>
                                <p className="text-sm text-slate-400">{member.profile?.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isAdmin && member.role !== 'owner' ? (
                                <select
                                    value={member.role}
                                    onChange={(e) => handleRoleChange(member.user_id, e.target.value as any)}
                                    className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="member">Member</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            ) : (
                                <span className="bg-slate-700 px-3 py-1.5 rounded text-sm capitalize">{member.role}</span>
                            )}

                            {isAdmin && member.role !== 'owner' && (
                                <button
                                    onClick={() => handleRemove(member.user_id)}
                                    className="text-red-400 hover:text-red-300 p-2 transition"
                                    title="Remove member"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full border border-slate-700">
                        <h2 className="text-2xl font-bold mb-6">Add Team Member</h2>

                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="colleague@company.com"
                                />
                                <p className="text-xs text-slate-500 mt-1">User must have an account</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                                <select
                                    value={inviteRole}
                                    onChange={e => setInviteRole(e.target.value as any)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="viewer">Viewer - Can view files</option>
                                    <option value="member">Member - Can view and comment</option>
                                    <option value="admin">Admin - Full access</option>
                                </select>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowInviteModal(false)
                                        setError('')
                                    }}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 py-3 rounded-lg font-semibold transition"
                                >
                                    {inviting ? 'Adding...' : 'Add Member'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
