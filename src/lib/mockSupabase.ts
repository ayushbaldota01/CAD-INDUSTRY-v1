// Mock Supabase client for local testing
// This replaces the real Supabase client when auth is unavailable

type MockProject = {
    id: string
    name: string
    description: string | null
    created_by: string
    created_at: string
    updated_at: string
}

type MockMember = {
    project_id: string
    user_id: string
    role: string
    joined_at: string
}

class MockSupabaseClient {
    private projects: MockProject[] = []
    private members: MockMember[] = []

    constructor() {
        // Only access localStorage in browser (not during SSR)
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('mock-projects')
            if (stored) {
                try {
                    const data = JSON.parse(stored)
                    this.projects = data.projects || []
                    this.members = data.members || []
                } catch (e) {
                    console.warn('Failed to load mock data from localStorage')
                }
            }
        }
    }

    private save() {
        if (typeof window !== 'undefined') {
            localStorage.setItem('mock-projects', JSON.stringify({
                projects: this.projects,
                members: this.members
            }))
        }
    }

    auth = {
        getUser: async () => ({
            data: {
                user: {
                    id: 'mock-admin-user',
                    email: 'admin@test.com'
                }
            },
            error: null
        }),
        getSession: async () => ({
            data: { session: { user: { id: 'mock-admin-user', email: 'admin@test.com' } } },
            error: null
        }),
        onAuthStateChange: () => ({
            data: { subscription: { unsubscribe: () => { } } }
        })
    }

    from(table: string) {
        const self = this

        return {
            select(columns = '*') {
                return {
                    eq(column: string, value: any) {
                        return {
                            async single() {
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
                                return { data: null, error: null }
                            },
                            async then(resolve: any) {
                                if (table === 'project_members') {
                                    const filtered = self.members.filter((m: any) => m[column] === value)
                                    resolve({ data: filtered, error: null })
                                }
                                if (table === 'profiles') {
                                    resolve({ data: [], error: null })
                                }
                            }
                        }
                    },
                    in(column: string, values: any[]) {
                        return {
                            order(col: string, opts: any) {
                                return {
                                    async then(resolve: any) {
                                        if (table === 'projects') {
                                            const filtered = self.projects.filter((p: any) => values.includes(p.id))
                                            resolve({ data: filtered, error: null })
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            insert(data: any) {
                return {
                    select() {
                        return {
                            async single() {
                                if (table === 'projects') {
                                    const newProject = {
                                        id: crypto.randomUUID(),
                                        ...data,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString()
                                    }
                                    self.projects.push(newProject)
                                    self.save()
                                    return { data: newProject, error: null }
                                }
                                if (table === 'project_members') {
                                    const newMember = {
                                        ...data,
                                        joined_at: new Date().toISOString()
                                    }
                                    self.members.push(newMember)
                                    self.save()
                                    return { data: newMember, error: null }
                                }
                                return { data: null, error: null }
                            }
                        }
                    }
                }
            },
            update(data: any) {
                return {
                    eq(column: string, value: any) {
                        return {
                            async then(resolve: any) {
                                if (table === 'projects') {
                                    const project = self.projects.find((p: any) => p[column] === value)
                                    if (project) {
                                        Object.assign(project, data, { updated_at: new Date().toISOString() })
                                        self.save()
                                    }
                                }
                                resolve({ error: null })
                            }
                        }
                    }
                }
            },
            delete() {
                return {
                    eq(column: string, value: any) {
                        return {
                            async then(resolve: any) {
                                if (table === 'projects') {
                                    self.projects = self.projects.filter((p: any) => p[column] !== value)
                                    self.save()
                                }
                                if (table === 'project_members') {
                                    self.members = self.members.filter((m: any) => m[column] !== value)
                                    self.save()
                                }
                                resolve({ error: null })
                            }
                        }
                    }
                }
            }
        }
    }
}

export const mockSupabase = new MockSupabaseClient()
