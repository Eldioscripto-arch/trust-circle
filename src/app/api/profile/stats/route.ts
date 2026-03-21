import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { createPublicClient, http } from 'viem'
import { worldchain } from 'viem/chains'

const MEMBERSHIP_ADDRESS = '0xB953016dF10c80496E86E8779697972cC9780094'
const MEMBERSHIP_ABI = [
  { type: 'function', name: 'memberships', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'level', type: 'uint8' }, { name: 'expiresAt', type: 'uint256' }, { name: 'claimedThisYear', type: 'uint256' }, { name: 'yearStart', type: 'uint256' }], stateMutability: 'view' }
]
const publicClient = createPublicClient({ chain: worldchain, transport: http('https://worldchain-mainnet.g.alchemy.com/public') })

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wallet = session.user.id.toLowerCase()

  const { data: memberships } = await supabaseAdmin
    .from('circle_members')
    .select('circle_id, circles(status)')
    .eq('wallet', wallet)

  const totalCircles     = memberships?.length ?? 0
  const completedCircles = memberships?.filter((m: any) => m.circles?.status === 'completed').length ?? 0

  const { count: completedRounds } = await supabaseAdmin
    .from('reputation_events')
    .select('id', { count: 'exact', head: true })
    .eq('wallet', wallet)
    .eq('event_type', 'contributed')

  const { count: activeDefaults } = await supabaseAdmin
    .from('reputation_events')
    .select('id', { count: 'exact', head: true })
    .eq('wallet', wallet)
    .eq('event_type', 'defaulted')

  const rounds = completedRounds ?? 0
  let scoreBase = 0
  if      (rounds >= 21) scoreBase = 4
  else if (rounds >= 11) scoreBase = 3
  else if (rounds >= 6)  scoreBase = 2
  else if (rounds >= 3)  scoreBase = 1

  const score      = Math.max(0, scoreBase - (activeDefaults ?? 0))
  const isEligible = (activeDefaults ?? 0) === 0

  let membership = null
  try {
    const result = await publicClient.readContract({
      address: MEMBERSHIP_ADDRESS as `0x${string}`,
      abi: MEMBERSHIP_ABI,
      functionName: 'memberships',
      args: [wallet as `0x${string}`],
    }) as [number, bigint, bigint, bigint]
    const level = result[0]
    const expiresAt = Number(result[1])
    if (level > 0 && expiresAt > Math.floor(Date.now() / 1000)) {
      membership = { level, expires_at: new Date(expiresAt * 1000).toISOString() }
    }
  } catch {}
  const MC_ADDRESS = '0x9adCCF3df7170ae5bED7dD17FDb977F866b0f8B3'
  const MC_ABI = [{ type: 'function', name: 'totalDebt', inputs: [{ name: 'member', type: 'address' }, { name: 'token', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }]
  const USDC    = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1'
  const WLD     = '0x2cFc85d8E48F8EAB294be644d9E25C3030863003'
  const AIONICO = '0x89C2A3fC33bc7cc1140e6408e050De230D5cC0Dc'
  let debtUSDC = 0n, debtWLD = 0n, debtAIONICO = 0n
  try {
    debtUSDC    = await publicClient.readContract({ address: MC_ADDRESS as `0x${string}`, abi: MC_ABI, functionName: 'totalDebt', args: [wallet as `0x${string}`, USDC    as `0x${string}`] }) as bigint
    debtWLD     = await publicClient.readContract({ address: MC_ADDRESS as `0x${string}`, abi: MC_ABI, functionName: 'totalDebt', args: [wallet as `0x${string}`, WLD     as `0x${string}`] }) as bigint
    debtAIONICO = await publicClient.readContract({ address: MC_ADDRESS as `0x${string}`, abi: MC_ABI, functionName: 'totalDebt', args: [wallet as `0x${string}`, AIONICO as `0x${string}`] }) as bigint
  } catch {}

  return NextResponse.json({
    stats: { totalCircles, completedCircles, score, isEligible, membership, debtUSDC: debtUSDC.toString(), debtWLD: debtWLD.toString(), debtAIONICO: debtAIONICO.toString() }
  })
}
