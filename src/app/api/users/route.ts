import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.name) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const wallet = session.user.name.toLowerCase()

  const { error } = await supabaseAdmin
    .from('users')
    .upsert({ wallet_address: wallet, last_login_at: new Date().toISOString() },
      { onConflict: 'wallet_address' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, wallet })
}
