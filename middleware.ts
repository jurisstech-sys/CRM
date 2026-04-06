import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({ name, value }))
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            req.cookies.set({ name, value })
            res.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Private routes that require authentication
  const privateRoutes = [
    '/dashboard',
    '/clients',
    '/pipeline',
    '/leads',
    '/commissions',
    '/reports',
    '/activities',
    '/admin',
  ]

  const isPrivateRoute = privateRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  )

  // Redirect to login if not authenticated
  if (isPrivateRoute && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Redirect authenticated users away from login
  if (req.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
