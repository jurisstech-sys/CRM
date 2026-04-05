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

  // Rotas privadas que exigem autenticação
  const privateRoutes = [
    '/dashboard',
    '/clients',
    '/pipeline',
    '/leads',
    '/commissions',
    '/reports',
    '/activities',
  ]

  const isPrivateRoute = privateRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  )

  // Se a rota é privada e o usuário não está autenticado, redireciona para /login
  if (isPrivateRoute && !session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Se o usuário está autenticado e tenta acessar /login, redireciona para /dashboard
  if (req.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
