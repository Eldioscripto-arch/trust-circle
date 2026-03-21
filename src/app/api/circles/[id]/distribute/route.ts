import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { createPublicClient, http } from 'viem'
import { worldchain } from 'viem/chains'

const publicClient = createPublicClient({
  chain: worldchain,
  transport: http('https://worldchain-mainnet.g.alchemy.com/public')
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
  if (!rateLimit(ip, 5)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

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

  // Verificar tx on-chain
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: transaction_id as `0x${string}`
    })
    if (!receipt || receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transacción no confirmada on-chain' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar la transacción' }, { status: 400 })
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
