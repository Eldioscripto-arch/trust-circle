import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wallet = session.user.id.toLowerCase()
  const { data, error } = await supabaseAdmin
    .from('circle_members')
    .select('circle_id, position, circles(*)')
    .eq('wallet', wallet)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar paidCount por círculo activo
  const enriched = await Promise.all((data ?? []).map(async (item: any) => {
    const c = item.circles
    if (!c || c.status !== 'active') return { ...item, paidCount: 0 }
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
  const { name, contributionAmount, cycleDurationSeconds, maxMembers, isPublic, isOpen, chain_id } = body
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
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from('circle_members').insert({
    circle_id: circle.id,
    wallet,
    position: 0,
  })

  await supabaseAdmin.from('circles').update({ member_count: 1 }).eq('id', circle.id)

  return NextResponse.json({ circle })
}
