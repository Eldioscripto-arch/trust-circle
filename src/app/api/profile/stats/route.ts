import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

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

  const { data: membership } = await supabaseAdmin
    .from('memberships')
    .select('level, expires_at')
    .eq('wallet', wallet)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  return NextResponse.json({
    stats: { totalCircles, completedCircles, score, isEligible, membership: membership ?? null }
  })
}
