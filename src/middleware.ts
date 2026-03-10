import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')
  const isApiPublic = req.nextUrl.pathname.startsWith('/api/circles') && req.method === 'GET'

  // Permitir rutas de auth siempre
  if (isApiAuth) return NextResponse.next()

  // Si no hay sesión → redirigir a login (página principal con AuthButton)
  if (!isLoggedIn && req.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}
