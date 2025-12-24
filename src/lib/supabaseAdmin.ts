import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// FORCE MOCK MODE - matches supabaseClient.ts
const FORCE_MOCK = false

// Create mock admin client (same structure as regular mock)
const createMockAdminClient = () => {
    const mockStore = {
        models: [] as any[],
        cad_files: [] as any[],
        files: [] as any[],
        activity_logs: [] as any[]
    }

    return {
        auth: {
            getUser: async () => ({
                data: { user: { id: 'mock-admin-user', email: 'admin@test.com' } },
                error: null
            })
        },
        storage: {
            from: (bucket: string) => ({
                upload: async (path: string, file: any) => {
                    console.log(`[MOCK ADMIN STORAGE] upload('${path}')`)
                    return {
                        data: {
                            path: path,
                            id: crypto.randomUUID(),
                            fullPath: `${bucket}/${path}`
                        },
                        error: null
                    }
                },
                remove: async (paths: string[]) => {
                    console.log(`[MOCK ADMIN STORAGE] remove([${paths.join(', ')}])`)
                    return {
                        data: null,
                        error: null
                    }
                },
                getPublicUrl: (path: string) => ({
                    data: {
                        publicUrl: `blob:mock-storage/${path}`
                    }
                })
            })
        },
        from: (table: string) => ({
            select: (columns = '*') => ({
                eq: (column: string, value: any) => ({
                    single: async () => {
                        const items = (mockStore as any)[table] || []
                        const item = items.find((i: any) => i[column] === value)
                        return { data: item || null, error: null }
                    }
                })
            }),
            insert: (data: any) => ({
                select: () => ({
                    single: async () => {
                        const newItem = {
                            id: crypto.randomUUID(),
                            ...data,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                            ; (mockStore as any)[table].push(newItem)
                        console.log(`[MOCK ADMIN] ${table} created:`, newItem)
                        return { data: newItem, error: null }
                    }
                })
            }),
            update: (data: any) => ({
                eq: (column: string, value: any) => ({
                    then: async (resolve: any) => {
                        const items = (mockStore as any)[table] || []
                        const item = items.find((i: any) => i[column] === value)
                        if (item) {
                            Object.assign(item, data, { updated_at: new Date().toISOString() })
                        }
                        resolve({ error: null })
                    }
                })
            })
        })
    }
}

const shouldUseMock = FORCE_MOCK ||
    !supabaseUrl ||
    supabaseUrl.includes('placeholder') ||
    !supabaseUrl.startsWith('https://') ||
    !supabaseServiceKey ||
    supabaseServiceKey === 'placeholder'

export const supabaseAdmin = shouldUseMock
    ? (createMockAdminClient() as any)
    : createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

if (shouldUseMock) {
    console.warn('[SERVER] Using MOCK Supabase Admin client')
}
