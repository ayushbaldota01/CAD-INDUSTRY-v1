
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState('')
    const router = useRouter()

    // Check if we are in demo/offline mode
    const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

    useEffect(() => {
        if (isDemoMode) {
            console.log('Demo Mode detected on Login Page')
        }
    }, [isDemoMode])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMsg('')

        if (isDemoMode) {
            // MOCK LOGIN SUCCESS
            console.warn('Demo Mode: Simulating login success.')

            // Set a mock user in localStorage so other pages can "see" a user
            const mockUser = {
                id: 'demo-user-123',
                email: email || 'demo@example.com',
                full_name: 'Demo Architect'
            }
            localStorage.setItem('cad-viewer-demo-user', JSON.stringify(mockUser))

            // Simulate network delay
            await new Promise(r => setTimeout(r, 600))

            alert('Logged in via Demo Mode (Offline).')
            router.push('/')
            return
        }

        // Real Supabase Login
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password })

            if (error) {
                // Try sign up if login fails
                if (error.message.includes('Invalid login') || error.message.includes('not found')) {
                    const { error: signUpError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: { data: { full_name: email.split('@')[0] } }
                    })
                    if (signUpError) {
                        setMsg(signUpError.message)
                    } else {
                        setMsg('New account created! Check email or try logging in.')
                        const { data: { user } } = await supabase.auth.getUser()
                        if (user) router.push('/')
                    }
                } else {
                    setMsg(error.message)
                }
            } else {
                router.push('/')
            }
        } catch (err: any) {
            // Network failures (like the one screenshot) end up here
            console.error('Login error:', err)
            if (err.message?.includes('Failed to fetch') || err.message?.includes('Network request failed')) {
                setMsg('Connection failed. Forcing Demo Mode...')
                // Force demo mode fallback
                const mockUser = { id: 'demo-user-fallback', email: email, full_name: 'Offline User' }
                localStorage.setItem('cad-viewer-demo-user', JSON.stringify(mockUser))
                setTimeout(() => router.push('/'), 1000)
            } else {
                setMsg('Login failed: ' + err.message)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
            <div className="w-full max-w-md p-8 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
                <h1 className="text-2xl font-bold mb-6 text-center">CAD Viewer Login</h1>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="demo@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="••••••••"
                        />
                    </div>

                    {msg && <p className="text-red-400 text-sm">{msg}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded font-medium transition disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Sign In / Sign Up'}
                    </button>

                    <p className="text-xs text-slate-500 text-center mt-4">
                        If account doesn't exist, we'll try to create it automatically.
                        <br />
                        <span className="text-indigo-400">Demo Mode Active: Any login works.</span>
                    </p>
                </form>
            </div>
        </div>
    )
}
