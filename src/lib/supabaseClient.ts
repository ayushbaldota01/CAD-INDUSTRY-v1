import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// FORCE MOCK MODE - Set to false to use real Supabase
const FORCE_MOCK = false

// Global mock data store
const mockStore = {
    projects: [] as any[],
    project_members: [] as any[],
    profiles: [] as any[],
    files: [] as any[],
    activity_logs: [] as any[],
    models: [] as any[]
}

// Simple in-memory mock
const createMockClient = () => {
    return {
        auth: {
            getUser: async () => {
                console.log('[MOCK AUTH] getUser called')
                return {
                    data: { user: { id: 'mock-admin-user', email: 'admin@test.com' } },
                    error: null
                }
            },
            getSession: async () => ({
                data: { session: { user: { id: 'mock-admin-user', email: 'admin@test.com' } } },
                error: null
            }),
            onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: () => { } } }
            })
        },
        storage: {
            from: (bucket: string) => {
                console.log(`[MOCK STORAGE] from('${bucket}')`)
                return {
                    upload: async (path: string, file: File) => {
                        console.log(`[MOCK STORAGE] upload('${path}', file)`, file.name, file.size)
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
                        console.log(`[MOCK STORAGE] remove([${paths.join(', ')}])`)
                        return {
                            data: null,
                            error: null
                        }
                    },
                    getPublicUrl: (path: string) => {
                        console.log(`[MOCK STORAGE] getPublicUrl('${path}')`)
                        return {
                            data: {
                                publicUrl: `blob:mock-storage/${path}`
                            }
                        }
                    }
                }
            }
        },
        from: (table: string) => {
            console.log(`[MOCK] from('${table}')`)

            return {
                select: (columns = '*') => {
                    console.log(`[MOCK] ${table}.select('${columns}')`)

                    return {
                        eq: (column: string, value: any) => {
                            console.log(`[MOCK] ${table}.eq('${column}', '${value}')`)

                            return {
                                single: async () => {
                                    if (table === 'profiles') {
                                        return {
                                            data: {
                                                id: 'mock-admin-user',
                                                email: 'admin@test.com',
                                                full_name: 'Test Admin',
                                                role: 'admin'
                                            },
                                            error: null
                                        }
                                    }
                                    const items = (mockStore as any)[table] || []
                                    const item = items.find((i: any) => i[column] === value)
                                    console.log(`[MOCK] ${table}.single() result:`, item)
                                    return { data: item || null, error: null }
                                },
                                then: async (resolve: any) => {
                                    const items = (mockStore as any)[table] || []
                                    const filtered = items.filter((i: any) => i[column] === value)
                                    console.log(`[MOCK] ${table}.eq() filtered:`, filtered)
                                    resolve({ data: filtered, error: null })
                                }
                            }
                        },
                        in: (column: string, values: any[]) => {
                            console.log(`[MOCK] ${table}.in('${column}', [${values.join(', ')}])`)

                            return {
                                order: (col: string, opts: any) => {
                                    console.log(`[MOCK] ${table}.order('${col}')`)

                                    return {
                                        then: async (resolve: any) => {
                                            const items = (mockStore as any)[table] || []
                                            const filtered = items.filter((i: any) => values.includes(i[column]))
                                            console.log(`[MOCK] ${table}.in() filtered:`, filtered)
                                            resolve({ data: filtered, error: null })
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                insert: (data: any) => {
                    console.log(`[MOCK] ${table}.insert()`, data)

                    return {
                        select: () => ({
                            single: async () => {
                                const newItem = {
                                    id: crypto.randomUUID(),
                                    ...data,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                }
                                    ; (mockStore as any)[table].push(newItem)
                                console.log(`[MOCK] ${table} created:`, newItem)
                                console.log(`[MOCK] ${table} total count:`, (mockStore as any)[table].length)
                                return { data: newItem, error: null }
                            }
                        }),
                        then: async (resolve: any) => {
                            const newItem = {
                                id: crypto.randomUUID(),
                                ...data,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }
                                ; (mockStore as any)[table].push(newItem)
                            console.log(`[MOCK] ${table} created (then):`, newItem)
                            resolve({ data: newItem, error: null })
                        }
                    }
                },
                update: (data: any) => ({
                    eq: (column: string, value: any) => ({
                        then: async (resolve: any) => {
                            const items = (mockStore as any)[table] || []
                            const item = items.find((i: any) => i[column] === value)
                            if (item) {
                                Object.assign(item, data, { updated_at: new Date().toISOString() })
                                console.log(`[MOCK] ${table} updated:`, item)
                            }
                            resolve({ error: null })
                        }
                    })
                }),
                delete: () => ({
                    eq: (column: string, value: any) => ({
                        then: async (resolve: any) => {
                            const items = (mockStore as any)[table] || []
                                ; (mockStore as any)[table] = items.filter((i: any) => i[column] !== value)
                            console.log(`[MOCK] ${table} deleted where ${column}=${value}`)
                            resolve({ error: null })
                        }
                    })
                })
            }
        }
    }
}

const shouldUseMock = FORCE_MOCK ||
    !supabaseUrl ||
    supabaseUrl.includes('placeholder') ||
    !supabaseUrl.startsWith('https://') ||
    !supabaseAnonKey ||
    supabaseAnonKey === 'placeholder'

export const supabase = shouldUseMock
    ? (createMockClient() as any)
    : createClient(supabaseUrl, supabaseAnonKey)

if (shouldUseMock) {
    console.warn('🔧 Using MOCK Supabase client (in-memory with logging)')
    console.warn('To use real Supabase, set FORCE_MOCK = false in supabaseClient.ts')
} else {
    console.log('✅ Using REAL Supabase client:', supabaseUrl)
}
