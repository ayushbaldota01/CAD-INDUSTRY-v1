
'use client'

import React, { useState, useEffect } from 'react'

interface ExportModalProps {
    fileId: string
    fileName: string
    onClose: () => void
    onExport?: (format: 'csv' | 'pdf') => void
}

export default function ExportModal({ fileId, fileName, onClose, onExport }: ExportModalProps) {
    const [exporting, setExporting] = useState(false)
    const [exportType, setExportType] = useState<'csv' | 'pdf'>('csv')

    // Keyboard support
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !exporting) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [exporting, onClose])

    const handleExportCSV = async () => {
        if (exporting) return // Prevent duplicate clicks
        setExporting(true)
        try {
            const response = await fetch(`/api/export?fileId=${fileId}&format=csv`)

            if (!response.ok) {
                throw new Error('Export failed')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${fileName}_export.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            onExport?.('csv')
            alert('CSV exported successfully!')
        } catch (e: any) {
            alert('Export failed: ' + e.message)
        } finally {
            setExporting(false)
        }
    }

    const handleExportPDF = async () => {
        if (exporting) return // Prevent duplicate clicks
        setExporting(true)
        try {
            const response = await fetch('/api/export-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId })
            })

            if (!response.ok) {
                throw new Error('Export failed')
            }

            const html = await response.text()

            // Open in new window for printing
            const printWindow = window.open('', '_blank')
            if (printWindow) {
                printWindow.document.write(html)
                printWindow.document.close()
                onExport?.('pdf')
            }

        } catch (e: any) {
            alert('Export failed: ' + e.message)
        } finally {
            setExporting(false)
        }
    }

    const handleExport = () => {
        if (exportType === 'csv') {
            handleExportCSV()
        } else {
            handleExportPDF()
        }
    }

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !exporting) {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-800">
                    <div>
                        <h3 className="font-semibold text-white">Export Data</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{fileName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition p-1"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Export Format
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setExportType('csv')}
                                className={`p-4 rounded-lg border transition ${exportType === 'csv'
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                    }`}
                            >
                                <div className="text-3xl mb-2">📊</div>
                                <div className="text-sm font-medium">CSV / Excel</div>
                                <div className="text-xs text-slate-400 mt-1">
                                    Spreadsheet format
                                </div>
                            </button>
                            <button
                                onClick={() => setExportType('pdf')}
                                className={`p-4 rounded-lg border transition ${exportType === 'pdf'
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                    }`}
                            >
                                <div className="text-3xl mb-2">📄</div>
                                <div className="text-sm font-medium">PDF Report</div>
                                <div className="text-xs text-slate-400 mt-1">
                                    Printable summary
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                        <div className="text-xs text-slate-300">
                            <div className="font-medium mb-1">Export includes:</div>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                                <li>All annotations with text and positions</li>
                                <li>Complete activity log</li>
                                <li>User information and timestamps</li>
                                <li>File version details</li>
                            </ul>
                        </div>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                    >
                        {exporting ? (
                            <>⏳ Exporting...</>
                        ) : (
                            <>
                                {exportType === 'csv' ? '📊 Export as CSV' : '📄 Export as PDF'}
                            </>
                        )}
                    </button>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-800/50">
                    <p className="text-xs text-slate-400 text-center">
                        {exportType === 'csv'
                            ? 'CSV file will download automatically'
                            : 'PDF will open in a new window for printing'}
                    </p>
                </div>
            </div>
        </div>
    )
}
