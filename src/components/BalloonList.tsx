import React, { useState } from 'react'
import { OverlayItem } from './PdfAnnotator'
import { PencilIcon, TrashIcon, MapPinIcon, CheckIcon, XMarkIcon, SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

type BalloonListProps = {
    items: OverlayItem[]
    selectedId: string | null
    onSelect: (id: string) => void
    onUpdate: (id: string, updates: Partial<OverlayItem>) => void
    onDelete: (id: string) => void
    onAutoBalloon?: () => void
    onExport?: () => void
}

export default function BalloonList({ items, selectedId, onSelect, onUpdate, onDelete, onAutoBalloon, onExport }: BalloonListProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<OverlayItem>>({})

    const sortedItems = [...items].sort((a, b) => (a.balloonNo || 0) - (b.balloonNo || 0))

    const handleEditStart = (item: OverlayItem) => {
        setEditingId(item.id)
        setEditForm({
            balloonNo: item.balloonNo,
            entityType: item.entityType,
            drawingReference: item.drawingReference || '',
            description: item.description || '',
            remarks: item.remarks || ''
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

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 w-80 shadow-xl overflow-hidden">
            <div className="p-4 bg-slate-800 border-b border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <MapPinIcon className="w-5 h-5 text-indigo-400" />
                        Balloon Manager
                    </h3>
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full">{items.length}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onAutoBalloon}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2 px-3 rounded transition-colors"
                        title="Auto-detect dimensions and update balloons"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        Auto Balloon
                    </button>
                    <button
                        onClick={onExport}
                        className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 px-3 rounded transition-colors"
                        title="Export to Excel"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sortedItems.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10 p-4">
                        <p className="text-sm">No balloons yet.</p>
                        <p className="text-xs mt-1">Click the PDF to add one.</p>
                    </div>
                ) : (
                    sortedItems.map(item => (
                        <div
                            key={item.id}
                            className={`rounded-lg border transition-all duration-200 ${selectedId === item.id || editingId === item.id
                                ? 'bg-slate-800 border-indigo-500 shadow-lg'
                                : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                                }`}
                        >
                            {editingId === item.id ? (
                                <div className="p-3 space-y-3">
                                    <div className="flex gap-2">
                                        <div className="w-1/3">
                                            <label className="text-[10px] uppercase text-slate-400 font-bold">No.</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none"
                                                value={editForm.balloonNo || ''}
                                                onChange={e => setEditForm({ ...editForm, balloonNo: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="w-2/3">
                                            <label className="text-[10px] uppercase text-slate-400 font-bold">Type</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none"
                                                value={editForm.entityType || 'Note'}
                                                onChange={e => setEditForm({ ...editForm, entityType: e.target.value as any })}
                                            >
                                                <option value="Dimension">Dimension</option>
                                                <option value="Tolerance">Tolerance</option>
                                                <option value="Note">Note</option>
                                                <option value="Specification">Specification</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] uppercase text-slate-400 font-bold">Reference</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none"
                                            value={editForm.drawingReference || ''}
                                            onChange={e => setEditForm({ ...editForm, drawingReference: e.target.value })}
                                            placeholder="e.g. 12.5mm"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] uppercase text-slate-400 font-bold">Description</label>
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-indigo-500 outline-none resize-none h-16"
                                            value={editForm.description || ''}
                                            onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                                        <button onClick={handleCancel} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                                            <XMarkIcon className="w-5 h-5" />
                                        </button>
                                        <button onClick={handleSave} className="p-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white">
                                            <CheckIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="p-3 cursor-pointer"
                                    onClick={() => onSelect(item.id)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${item.type === 'issue'
                                                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                                : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                                                }`}>
                                                {item.balloonNo || '?'}
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium text-slate-300">{item.entityType || 'Note'}</div>
                                                {item.drawingReference && (
                                                    <div className="text-[10px] text-slate-500 font-mono">{item.drawingReference}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEditStart(item); }}
                                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                                className="p-1 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {item.description && (
                                        <div className="text-xs text-slate-400 line-clamp-2 pl-8">
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
