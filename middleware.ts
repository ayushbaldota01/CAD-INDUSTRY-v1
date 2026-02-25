import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED = ['/upload', '/view', '/projects', '/annotate']

// Routes only for unauthenticated users
const AUTH_ONLY = ['/login', '/signup']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Build a response we may mutate (for cookie refresh)
    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    // Only run auth check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        // Not configured — allow all routes (dev / offline mode)
        return response
    }

    try {
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                        response.cookies.set(name, value, options)
                    })
                },
            },
        })

        const { data: { session } } = await supabase.auth.getSession()
        const isAuthenticated = !!session

        const isProtected = PROTECTED.some(p => pathname.startsWith(p))
        const isAuthOnly = AUTH_ONLY.some(p => pathname.startsWith(p))

        // Redirect unauthenticated users away from protected routes
        if (isProtected && !isAuthenticated) {
            const loginUrl = request.nextUrl.clone()
            loginUrl.pathname = '/login'
            loginUrl.searchParams.set('next', pathname)
            return NextResponse.redirect(loginUrl)
        }

        // Redirect authenticated users away from login/signup
        if (isAuthOnly && isAuthenticated) {
            const dashboardUrl = request.nextUrl.clone()
            dashboardUrl.pathname = '/'
            dashboardUrl.searchParams.delete('next')
            return NextResponse.redirect(dashboardUrl)
        }
    } catch {
        // If Supabase is unreachable, fail open (don't block the user)
    }

    return response
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
