import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({
    ok: true,
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
    nextauth_secret: !!process.env.NEXTAUTH_SECRET,
  })
}
