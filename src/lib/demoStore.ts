'use client'

// A simple global store for demo purposes (since we don't have a real DB connected in demo mode)
// We use a global variable on the window object to persist across client navigation AND HMR updates.

export interface DemoFile {
    id: string
    name: string
    file: File
    url: string
    type: '3D' | 'PDF'
    date: Date
}

// Use a global variable attached to window/globalThis to allow data to survive Hot Module Replacement (HMR)
const GLOBAL_KEY = '__CAD_VIEWER_DEMO_FILES__'

// Initialize store from global or create new array
const getStore = (): DemoFile[] => {
    if (typeof window === 'undefined') return []
    if (!(window as any)[GLOBAL_KEY]) {
        (window as any)[GLOBAL_KEY] = []
    }
    return (window as any)[GLOBAL_KEY]
}

export const demoStore = {
    addFile: (file: File) => {
        const store = getStore()
        const id = 'demo-' + Date.now()

        // Revoke old URLs to prevent memory leaks if we have too many
        if (store.length > 20) {
            const old = store.pop()
            if (old) URL.revokeObjectURL(old.url)
        }

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
        store.unshift(record)
        return record
    },

    getFile: (id: string) => {
        const store = getStore()
        return store.find(f => f.id === id)
    },

    getAll: () => {
        return getStore()
    }
}
