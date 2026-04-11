import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  if (isApiRoute) return NextResponse.next();
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
