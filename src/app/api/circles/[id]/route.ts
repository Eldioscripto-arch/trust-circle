import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPublicClient, http } from 'viem'
import { worldchain } from 'viem/chains'

const TRUST_CIRCLE_ADDRESS = '0xc32Bdc20014B8aE63FCA57597b29DAC856BCE2Cf'
const GET_CIRCLE_ABI = [{ type: 'function', name: 'getCircle', inputs: [{ name: 'circleId', type: 'uint256' }], outputs: [{ name: 'id', type: 'uint256' }, { name: 'creator', type: 'address' }, { name: 'name', type: 'string' }, { name: 'token', type: 'address' }, { name: 'contributionAmount', type: 'uint256' }, { name: 'cycleDuration', type: 'uint256' }, { name: 'maxMembers', type: 'uint8' }, { name: 'memberCount', type: 'uint8' }, { name: 'currentCycle', type: 'uint8' }, { name: 'cycleStartTime', type: 'uint256' }, { name: 'status', type: 'uint8' }], stateMutability: 'view' }]
const publicClient = createPublicClient({ chain: worldchain, transport: http('https://worldchain-mainnet.g.alchemy.com/public') })

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const { data: circle, error } = await supabaseAdmin
    .from('circles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !circle) {
    return NextResponse.json({ error: 'Círculo no encontrado' }, { status: 404 })
  }

  const { data: members } = await supabaseAdmin
    .from('circle_members')
    .select('wallet, position, joined_at')
    .eq('circle_id', id)
    .order('position', { ascending: true })

  // Si tiene chain_id, leer currentCycle y cycleStartTime del contrato
  if (circle.chain_id) {
    try {
      const onchain = await publicClient.readContract({
        address: TRUST_CIRCLE_ADDRESS as `0x${string}`,
        abi: GET_CIRCLE_ABI,
        functionName: 'getCircle',
        args: [BigInt(circle.chain_id)],
      }) as any[]
      circle.current_cycle = Number(onchain[8])
      circle.cycle_start_time = new Date(Number(onchain[9]) * 1000).toISOString()
    } catch {}
  }

  return NextResponse.json({ circle, members: members ?? [] })
}
