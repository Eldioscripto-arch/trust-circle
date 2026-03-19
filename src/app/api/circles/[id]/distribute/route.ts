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
  const { transaction_id, cycle, recipient } = await req.json()

  if (!transaction_id) {
    return NextResponse.json({ error: 'transaction_id required' }, { status: 400 })
  }

  await supabaseAdmin.from('reputation_events').insert([
    {
      wallet,
      circle_id: id,
      event_type: 'distributed',
    },
    ...(recipient && recipient !== wallet ? [{
      wallet: recipient,
      circle_id: id,
      event_type: 'received',
    }] : []),
  ])

  await supabaseAdmin
    .from('circles')
    .update({ current_cycle: (cycle ?? 1) + 1 })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
