import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const wallet = session.user.id.toLowerCase()
  const { id } = params
  const { transaction_id, cycle } = await req.json()

  if (!transaction_id) {
    return NextResponse.json({ error: 'transaction_id required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('circle_payments')
    .insert({
      circle_id: id,
      wallet,
      transaction_id,
      cycle: cycle ?? 1,
      paid_at: new Date().toISOString(),
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabaseAdmin.from('reputation_events').insert({
    wallet,
    circle_id: id,
    event_type: 'contributed',
  })

  return NextResponse.json({ success: true })
}
