import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { createPublicClient, http } from 'viem'
import { worldchain } from 'viem/chains'

const TRUST_CIRCLE_ADDRESS = '0xc32Bdc20014B8aE63FCA57597b29DAC856BCE2Cf'
const GET_CIRCLE_ABI = [{ type: 'function', name: 'getCircle', inputs: [{ name: 'circleId', type: 'uint256' }], outputs: [{ name: 'id', type: 'uint256' }, { name: 'creator', type: 'address' }, { name: 'name', type: 'string' }, { name: 'token', type: 'address' }, { name: 'contributionAmount', type: 'uint256' }, { name: 'cycleDuration', type: 'uint256' }, { name: 'maxMembers', type: 'uint8' }, { name: 'memberCount', type: 'uint8' }, { name: 'currentCycle', type: 'uint8' }, { name: 'cycleStartTime', type: 'uint256' }, { name: 'status', type: 'uint8' }], stateMutability: 'view' }]
const publicClient = createPublicClient({ chain: worldchain, transport: http('https://worldchain-mainnet.g.alchemy.com/public') })

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wallet = session.user.id.toLowerCase()
  const { data, error } = await supabaseAdmin
    .from('circle_members')
    .select('circle_id, position, circles(*)')
    .eq('wallet', wallet)
    .neq('circles.status', 'cancelled')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar paidCount por círculo activo
  const enriched = await Promise.all((data ?? []).map(async (item: any) => {
    const c = item.circles
    if (!c || c.status !== 'active') return { ...item, paidCount: 0 }

    // Sincronizar currentCycle y cycleStartTime desde el contrato
    if (c.chain_id) {
      try {
        const onchain = await publicClient.readContract({
          address: TRUST_CIRCLE_ADDRESS as `0x${string}`,
          abi: GET_CIRCLE_ABI,
          functionName: 'getCircle',
          args: [BigInt(c.chain_id)],
        }) as any[]
        c.current_cycle = Number(onchain[8])
        c.cycle_start_time = new Date(Number(onchain[9]) * 1000).toISOString()
      } catch {}
    }

    const { count } = await supabaseAdmin
      .from('circle_payments')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', c.id)
      .eq('cycle', c.current_cycle ?? 1)
    return { ...item, paidCount: count ?? 0 }
  }))

  return NextResponse.json({ circles: enriched })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wallet = session.user.id.toLowerCase()

  const body = await req.json()
  const { name, contributionAmount, cycleDurationSeconds, maxMembers, isPublic, isOpen, chain_id, token } = body
  if (!name || !contributionAmount || !cycleDurationSeconds || !maxMembers)
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const inviteCode = isPublic ? null : Math.random().toString(36).substring(2, 10).toUpperCase()

  const { data: circle, error } = await supabaseAdmin
    .from('circles')
    .insert({
      name,
      creator_wallet: wallet,
      contribution_amount: contributionAmount,
      cycle_duration_seconds: cycleDurationSeconds,
      max_members: maxMembers,
      is_public: isPublic ?? true,
      is_open: isOpen ?? true,
      invite_code: inviteCode,
      status: 'open',
      chain_id: chain_id ?? null,
      token: token ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: memberError } = await supabaseAdmin.from('circle_members').insert({
    circle_id: circle.id,
    wallet,
    position: 0,
  })

  if (memberError) {
    await supabaseAdmin.from('circles').delete().eq('id', circle.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('circles')
    .update({ member_count: 1 })
    .eq('id', circle.id)

  if (updateError) {
    await supabaseAdmin.from('circles').delete().eq('id', circle.id)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ circle })
}
