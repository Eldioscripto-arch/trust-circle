import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const wallet = session.user.id.toLowerCase()
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('wallet_address', wallet)
    .single()
  return NextResponse.json({ user })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const wallet = session.user.id.toLowerCase()
  const { error } = await supabaseAdmin
    .from('users')
    .upsert(
      { wallet_address: wallet, last_login_at: new Date().toISOString() },
      { onConflict: 'wallet_address' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, wallet })
}
