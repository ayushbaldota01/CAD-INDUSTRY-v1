/**
 * Supabase Client - Production Ready
 * 
 * Handles both real Supabase connections and graceful fallback
 * when the backend is unavailable. No more network errors flooding the console.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_CONFIG, IS_BROWSER } from './config'

// Types for our data
export type Project = {
    id: string
    name: string
    description: string | null
    created_by: string
    created_at: string
    updated_at: string
}

export type Profile = {
    id: string
    email: string
    full_name: string | null
    role: string
}

export type FileRecord = {
    id: string
    name: string
    file_type: string
    storage_path: string
    project_id: string | null
    created_at: string
}

// Create a mock client that doesn't make network requests
function createOfflineClient(): SupabaseClient {
    const noopPromise = () => Promise.resolve({ data: null, error: null })
    const noopWithData = <T>(data: T) => Promise.resolve({ data, error: null })

    // Create a session-local store
    const localStore: Record<string, any[]> = {
        projects: [],
        files: [],
        profiles: [],
        project_members: [],
        activity_logs: [],
        annotations: [],
    }

    const mockClient = {
        auth: {
            getUser: () => noopWithData({ user: null }),
            getSession: () => noopWithData({ session: null }),
            onAuthStateChange: (callback: any) => {
                // Call with no session immediately
                setTimeout(() => callback('SIGNED_OUT', null), 0)
                return {
                    data: {
                        subscription: {
                            unsubscribe: () => { }
                        }
                    }
                }
            },
            signInWithPassword: () => noopWithData({ user: null, session: null }),
            signUp: () => noopWithData({ user: null, session: null }),
            signOut: () => noopPromise(),
            resetPasswordForEmail: () => noopPromise(),
            updateUser: () => noopPromise(),
        },

        storage: {
            from: (bucket: string) => ({
                upload: (path: string, file: File) => {
                    if (IS_BROWSER) {
                        // Create a local blob URL for demo purposes
                        const url = URL.createObjectURL(file)
                        return Promise.resolve({
                            data: { path, id: `local-${Date.now()}`, fullPath: `${bucket}/${path}` },
                            error: null
                        })
                    }
                    return noopPromise()
                },
                download: () => noopPromise(),
                remove: () => noopPromise(),
                getPublicUrl: (path: string) => ({
                    data: { publicUrl: '' }
                }),
                createSignedUrl: () => noopWithData({ signedUrl: null }),
            })
        },

        from: (table: string) => {
            const store = localStore[table] || []

            const createQueryBuilder = (currentData: any[] = store) => ({
                select: (columns = '*') => createQueryBuilder(currentData),

                eq: (column: string, value: any) => {
                    const filtered = currentData.filter((item: any) => item[column] === value)
                    return {
                        ...createQueryBuilder(filtered),
                        single: () => Promise.resolve({
                            data: filtered[0] || null,
                            error: null
                        })
                    }
                },

                in: (column: string, values: any[]) => ({
                    ...createQueryBuilder(currentData.filter((item: any) => values.includes(item[column]))),
                    order: (col: string, opts?: any) => ({
                        then: (resolve: any) => resolve({
                            data: currentData.filter((item: any) => values.includes(item[column])),
                            error: null
                        })
                    })
                }),

                order: (column: string, options?: any) => createQueryBuilder(currentData),
                limit: (n: number) => createQueryBuilder(currentData.slice(0, n)),

                single: () => Promise.resolve({
                    data: currentData[0] || null,
                    error: null
                }),

                then: (resolve: any) => resolve({
                    data: currentData,
                    error: null
                })
            })

            return {
                ...createQueryBuilder(),

                insert: (data: any) => {
                    const newItem = {
                        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        ...data,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                    localStore[table] = [...(localStore[table] || []), newItem]

                    return {
                        select: () => ({
                            single: () => Promise.resolve({ data: newItem, error: null })
                        }),
                        then: (resolve: any) => resolve({ data: newItem, error: null })
                    }
                },

                update: (data: any) => ({
                    eq: (column: string, value: any) => {
                        const items = localStore[table] || []
                        const index = items.findIndex((i: any) => i[column] === value)
                        if (index >= 0) {
                            items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() }
                        }
                        return { then: (resolve: any) => resolve({ error: null }) }
                    }
                }),

                delete: () => ({
                    eq: (column: string, value: any) => {
                        localStore[table] = (localStore[table] || []).filter((i: any) => i[column] !== value)
                        return { then: (resolve: any) => resolve({ error: null }) }
                    }
                }),

                upsert: (data: any) => {
                    return {
                        then: (resolve: any) => resolve({ data, error: null })
                    }
                }
            }
        },

        rpc: (funcName: string, params?: any) => noopWithData([]),
    }

    return mockClient as unknown as SupabaseClient
}

// Connection state
let connectionTested = false
let isOnline = false

// Test connection with a simple ping
async function testConnection(client: SupabaseClient): Promise<boolean> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        const { error } = await client.auth.getSession()
        clearTimeout(timeout)

        return !error
    } catch {
        return false
    }
}

// Create the appropriate client
function initializeClient(): SupabaseClient {
    // Check if Supabase is configured
    if (!SUPABASE_CONFIG.isConfigured) {
        console.log('📦 Supabase not configured - using local mode')
        return createOfflineClient()
    }

    // Try to create real client
    try {
        const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            },
            global: {
                fetch: (url, options) => {
                    // Add timeout to all fetch requests
                    const controller = new AbortController()
                    const timeout = setTimeout(() => controller.abort(), 10000)

                    return fetch(url, {
                        ...options,
                        signal: controller.signal,
                    }).finally(() => clearTimeout(timeout))
                }
            }
        })

        console.log('✅ Supabase client initialized:', SUPABASE_CONFIG.url)
        return client
    } catch (error) {
        console.warn('⚠️ Failed to initialize Supabase client - using local mode')
        return createOfflineClient()
    }
}

// Export the client
export const supabase = initializeClient()

// Export utility to check online status
export async function checkSupabaseConnection(): Promise<boolean> {
    if (connectionTested) return isOnline

    if (!SUPABASE_CONFIG.isConfigured) {
        connectionTested = true
        isOnline = false
        return false
    }

    isOnline = await testConnection(supabase)
    connectionTested = true

    if (!isOnline) {
        console.warn('⚠️ Supabase connection unavailable - features will be limited')
    }

    return isOnline
}

// Export the config status
export const isOfflineMode = !SUPABASE_CONFIG.isConfigured
