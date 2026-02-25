import React, { useState } from 'react'
import { OverlayItem } from './PdfAnnotator'
import { PencilIcon, TrashIcon, MapPinIcon, CheckIcon, XMarkIcon, SparklesIcon, ArrowDownTrayIcon, ChevronDownIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'

type BalloonListProps = {
    items: OverlayItem[]
    selectedId: string | null
    onSelect: (id: string) => void
    onUpdate: (id: string, updates: Partial<OverlayItem>) => void
    onDelete: (id: string) => void
    onAutoBalloon?: () => void
    onExport?: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Only 'comment' and 'issue' types are proper balloons */
const BALLOON_TYPES: OverlayItem['type'][] = ['comment', 'issue', 'callout']

/** Derive the user-facing label from color and type */
function getBalloonLabel(item: OverlayItem): { label: string; color: 'blue' | 'red' | 'neutral' } {
    const isIssue = item.type === 'issue'
    const colorStr = (item.color || '').toLowerCase()

    // Explicit red colours → Critical
    if (isIssue || colorStr.includes('#ef') || colorStr.includes('#f87') || colorStr === 'red' || colorStr.includes('#dc') || colorStr.includes('#b91')) {
        return { label: 'Critical', color: 'red' }
    }
    // Explicit blue colours → Comment
    if (colorStr.includes('#3b8') || colorStr.includes('#60a') || colorStr.includes('#2563') || colorStr === 'blue' || colorStr.includes('#0ea')) {
        return { label: 'Comment', color: 'blue' }
    }
    // Fallback: use entityType if set, or colour-guess
    if (item.entityType && item.entityType !== 'Note') return { label: item.entityType, color: 'neutral' }
    return { label: item.type === 'comment' ? 'Comment' : item.type === 'issue' ? 'Critical' : 'Note', color: 'neutral' }
}

function BalloonBadge({ item }: { item: OverlayItem }) {
    const { label, color } = getBalloonLabel(item)
    if (color === 'red') {
        return (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20 text-red-400 border border-red-500/60 text-xs font-bold shrink-0">
                {item.balloonNo ?? '?'}
            </div>
        )
    }
    if (color === 'blue') {
        return (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/60 text-xs font-bold shrink-0">
                {item.balloonNo ?? '?'}
            </div>
        )
    }
    return (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 text-xs font-bold shrink-0">
            {item.balloonNo ?? '?'}
        </div>
    )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function BalloonList({ items, selectedId, onSelect, onUpdate, onDelete, onAutoBalloon, onExport }: BalloonListProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<OverlayItem>>({})
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // ── ONLY show true balloon types ──
    const balloonItems = items.filter(i => BALLOON_TYPES.includes(i.type as any))
    const sortedItems = [...balloonItems].sort((a, b) => (a.balloonNo || 0) - (b.balloonNo || 0))

    const handleEditStart = (item: OverlayItem) => {
        setEditingId(item.id)
        setEditForm({
            balloonNo: item.balloonNo,
            entityType: item.entityType,
            drawingReference: item.drawingReference || '',
            description: item.description || '',
            remarks: item.remarks || '',
            text: item.text || ''
        })
    }

    const handleSave = () => {
        if (editingId) {
            onUpdate(editingId, editForm)
            setEditingId(null)
            setEditForm({})
        }
    }

    const handleCancel = () => {
        setEditingId(null)
        setEditForm({})
    }

    const handleRowClick = (item: OverlayItem) => {
        onSelect(item.id)
        setExpandedId(prev => prev === item.id ? null : item.id)
    }

    return (
        <div className="flex flex-col h-full bg-[#0f1117] border-l border-slate-800 w-80 shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-[#13151f]">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-white flex items-center gap-2 text-sm tracking-wide">
                        <MapPinIcon className="w-5 h-5 text-indigo-400" />
                        Balloon Manager
                    </h3>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                        {sortedItems.length}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onAutoBalloon}
                        className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all"
                        title="Auto-detect dimensions and update balloons"
                    >
                        <SparklesIcon className="w-3.5 h-3.5" />
                        Auto Balloon
                    </button>
                    <button
                        onClick={onExport}
                        className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all"
                        title="Export to Excel"
                    >
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        Export
                    </button>
                </div>

                {/* Legend */}
                <div className="mt-3 flex gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Comment
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Critical
                    </span>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {sortedItems.length === 0 ? (
                    <div className="text-center text-slate-500 mt-12 px-4">
                        <MapPinIcon className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                        <p className="text-sm font-medium text-slate-400">No balloons yet</p>
                        <p className="text-xs mt-1 text-slate-600">Use the Comment or Issue tool on the PDF to place balloons.</p>
                    </div>
                ) : (
                    sortedItems.map(item => {
                        const { label, color } = getBalloonLabel(item)
                        const isExpanded = expandedId === item.id
                        const isSelected = selectedId === item.id
                        const isEditing = editingId === item.id

                        return (
                            <div
                                key={item.id}
                                className={`rounded-xl border transition-all duration-200 group ${isSelected
                                        ? color === 'red'
                                            ? 'bg-red-950/30 border-red-500/50 shadow-md shadow-red-900/20'
                                            : 'bg-indigo-950/30 border-indigo-500/50 shadow-md shadow-indigo-900/20'
                                        : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'
                                    }`}
                            >
                                {isEditing ? (
                                    /* ── EDIT FORM ── */
                                    <div className="p-3 space-y-3">
                                        <div className="flex gap-2">
                                            <div className="w-1/3">
                                                <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">No.</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none mt-1"
                                                    value={editForm.balloonNo || ''}
                                                    onChange={e => setEditForm({ ...editForm, balloonNo: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="w-2/3">
                                                <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Type</label>
                                                <select
                                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none mt-1"
                                                    value={editForm.entityType || 'Note'}
                                                    onChange={e => setEditForm({ ...editForm, entityType: e.target.value as any })}
                                                >
                                                    <option value="Comment">Comment</option>
                                                    <option value="Critical">Critical</option>
                                                    <option value="Dimension">Dimension</option>
                                                    <option value="Tolerance">Tolerance</option>
                                                    <option value="Note">Note</option>
                                                    <option value="Specification">Specification</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Comment / Text</label>
                                            <textarea
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none resize-none h-16 mt-1"
                                                value={editForm.text || ''}
                                                placeholder="Add a note or comment..."
                                                onChange={e => setEditForm({ ...editForm, text: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Reference</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none mt-1"
                                                value={editForm.drawingReference || ''}
                                                placeholder="e.g. ISO 12.5mm"
                                                onChange={e => setEditForm({ ...editForm, drawingReference: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Description</label>
                                            <textarea
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none resize-none h-14 mt-1"
                                                value={editForm.description || ''}
                                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                            />
                                        </div>

                                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                                            <button onClick={handleCancel} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition">
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={handleSave} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition">
                                                <CheckIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── COLLAPSED / EXPANDED VIEW ── */
                                    <div>
                                        {/* Row header — always visible, click to expand */}
                                        <div
                                            className="flex items-center gap-2 p-3 cursor-pointer select-none"
                                            onClick={() => handleRowClick(item)}
                                        >
                                            <BalloonBadge item={item} />

                                            <div className="flex-1 min-w-0">
                                                {/* Label: "Comment" or "Critical" */}
                                                <div className={`text-xs font-semibold ${color === 'red' ? 'text-red-400' :
                                                        color === 'blue' ? 'text-blue-400' :
                                                            'text-slate-300'
                                                    }`}>
                                                    {label}
                                                </div>
                                                {/* Preview of comment text */}
                                                {item.text && (
                                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                                        {item.text}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action buttons — always shown (not hidden by group-hover) */}
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleEditStart(item) }}
                                                    className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); onDelete(item.id) }}
                                                    className="p-1.5 hover:bg-red-900/40 rounded text-slate-500 hover:text-red-400 transition"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {/* Expanded detail panel */}
                                        {isExpanded && (
                                            <div className="px-3 pb-3 border-t border-slate-800/60 mt-0 pt-3 space-y-2">
                                                {/* Comment / Text */}
                                                {item.text ? (
                                                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
                                                        <div className="flex items-center gap-1 text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1.5">
                                                            <ChatBubbleLeftIcon className="w-3 h-3" />
                                                            Comment
                                                        </div>
                                                        <p className="text-sm text-slate-200 leading-relaxed">{item.text}</p>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-600 italic text-center py-1">No comment text</div>
                                                )}

                                                {/* Reference */}
                                                {item.drawingReference && (
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-slate-500 shrink-0">Ref:</span>
                                                        <span className="text-slate-300 font-mono bg-slate-800 px-2 py-0.5 rounded">{item.drawingReference}</span>
                                                    </div>
                                                )}

                                                {/* Description */}
                                                {item.description && (
                                                    <div>
                                                        <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Description</div>
                                                        <p className="text-xs text-slate-400">{item.description}</p>
                                                    </div>
                                                )}

                                                {/* Remarks */}
                                                {item.remarks && (
                                                    <div>
                                                        <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Remarks</div>
                                                        <p className="text-xs text-slate-400">{item.remarks}</p>
                                                    </div>
                                                )}

                                                {/* Page badge */}
                                                <div className="flex justify-between items-center pt-1">
                                                    <span className="text-[10px] text-slate-600">Page {item.page || 1}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color === 'red'
                                                            ? 'bg-red-900/40 text-red-400 border border-red-700/40'
                                                            : color === 'blue'
                                                                ? 'bg-blue-900/40 text-blue-400 border border-blue-700/40'
                                                                : 'bg-slate-800 text-slate-400'
                                                        }`}>
                                                        {label}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
