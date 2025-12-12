
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Model = {
  id: string
  name: string
  file_type: string
  created_at: string
  width?: number // Mock size or whatever
}

export default function Home() {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    // Check auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
      } else {
        // Check local mock session
        const mock = localStorage.getItem('cad-viewer-demo-user')
        if (mock) {
          setSession({ user: JSON.parse(mock) })
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    fetchModels()

    return () => subscription.unsubscribe()
  }, [])

  const fetchModels = async () => {
    setLoading(true)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')) {
      setLoading(false)
      return // Skip fetch in demo mode (so we don't spam console errors)
    }

    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error(error)
      } else {
        setModels(data || [])
      }
    } catch (e) {
      console.error('Fetch models failed', e)
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">CAD Review Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage 3D models and specifications</p>
          </div>
          <div className="flex gap-4 items-center">
            {session ? (
              <div className="text-sm text-slate-600">
                Logged in as <span className="font-semibold">{session.user.email}</span>
              </div>
            ) : (
              <Link href="/login" className="text-indigo-600 font-medium hover:underline">
                Log In
              </Link>
            )}
            <Link href="/upload" className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm flex items-center gap-2">
              <span>+</span> Upload Asset
            </Link>
          </div>
        </header>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-semibold text-slate-800">Recent Projects</h2>
            <button onClick={fetchModels} className="text-sm text-indigo-600 font-medium hover:underline">Refresh</button>
          </div>

          <div className="divide-y divide-slate-100">
            {loading && <div className="p-8 text-center text-slate-400">Loading projects...</div>}

            {!loading && models.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-slate-500 mb-4">No models found.</p>
                <Link href="/upload" className="text-indigo-600 hover:underline">Upload your first model</Link>
              </div>
            )}

            {!loading && models.map((file) => (
              <div key={file.id} className="group flex items-center justify-between p-4 hover:bg-slate-50 transition">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl shadow-sm ${file.file_type === 'glb' ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
                    {file.file_type === 'glb' || file.file_type === 'gltf' ? '🎲' : '📄'}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 group-hover:text-indigo-600 transition">{file.name}</h3>
                    <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                      <span>{new Date(file.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span className="uppercase">{file.file_type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/view/${file.id}?name=${encodeURIComponent(file.name)}&type=${file.file_type === 'pdf' ? 'PDF' : '3D'}`}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
