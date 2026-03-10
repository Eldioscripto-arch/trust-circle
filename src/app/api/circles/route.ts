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
  return NextResponse.json({ circles: data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const wallet = session.user.id.toLowerCase()

  // Verificar que tiene World ID verificado
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('world_id_verified')
    .eq('wallet_address', wallet)
    .single()

  if (!user?.world_id_verified) {
    return NextResponse.json({ error: 'Debes verificar tu World ID para crear círculos' }, { status: 403 })
  }

  const body = await req.json()
  const { name, contributionAmount, cycleDurationSeconds, maxMembers, isPublic } = body
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
      is_public: isPublic,
      invite_code: inviteCode,
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar creador como miembro posición 0
  await supabaseAdmin.from('circle_members').insert({
    circle_id: circle.id,
    wallet,
    position: 0,
  })

  await supabaseAdmin.from('circles').update({ member_count: 1 }).eq('id', circle.id)

  return NextResponse.json({ circle })
}
