
'use client'

// A simple global store for demo purposes (since we don't have a real DB connected in demo mode)
// In a real app, this would be Redux, Zustand, or simple SWR caching.
// We use a global variable on the window object or module scope to persist across client navigation.

export interface DemoFile {
    id: string
    name: string
    file: File
    url: string
    type: '3D' | 'PDF'
    date: Date
}

// Module-level cache (resets on refresh)
const DEMO_FILES: DemoFile[] = []

export const demoStore = {
    addFile: (file: File) => {
        const id = 'demo-' + Date.now()
        const url = URL.createObjectURL(file)
        const type = file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : '3D' as const

        const record: DemoFile = {
            id,
            name: file.name,
            file,
            url,
            type,
            date: new Date()
        }
        DEMO_FILES.unshift(record)
        return record
    },

    getFile: (id: string) => {
        return DEMO_FILES.find(f => f.id === id)
    },

    getAll: () => {
        return DEMO_FILES
    }
}
