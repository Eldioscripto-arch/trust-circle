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
  const { id: circleId } = params
  const { proof, merkle_root, nullifier_hash, verification_level } = await req.json()

  if (!proof || !merkle_root || !nullifier_hash) {
    return NextResponse.json({ error: 'Faltan datos del proof' }, { status: 400 })
  }

  // 1. Verificar proof con World ID API
  const verifyRes = await fetch(
    `https://developer.worldcoin.org/api/v2/verify/${process.env.NEXT_PUBLIC_APP_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nullifier_hash,
        merkle_root,
        proof,
        verification_level: verification_level ?? 'orb',
        action: 'join-circle-v1',
        signal: wallet,
      }),
    }
  )

  const verifyData = await verifyRes.json()
  if (!verifyRes.ok || !verifyData.success) {
    return NextResponse.json(
      { error: 'World ID verification failed', detail: verifyData },
      { status: 400 }
    )
  }

  // 2. Verificar círculo
  const { data: circle, error: circleError } = await supabaseAdmin
    .from('circles')
    .select('*')
    .eq('id', circleId)
    .single()

  if (circleError || !circle) {
    return NextResponse.json({ error: 'Círculo no encontrado' }, { status: 404 })
  }
  if (circle.status !== 'open') {
    return NextResponse.json({ error: 'El círculo ya no está abierto' }, { status: 400 })
  }
  if (circle.member_count >= circle.max_members) {
    return NextResponse.json({ error: 'El círculo está lleno' }, { status: 400 })
  }

  // 3. Verificar que no es ya miembro
  const { data: existing } = await supabaseAdmin
    .from('circle_members')
    .select('id')
    .eq('circle_id', circleId)
    .eq('wallet', wallet)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ya eres miembro de este círculo' }, { status: 400 })
  }

  // 4. Verificar nullifier no usado
  const { data: usedNullifier } = await supabaseAdmin
    .from('circle_members')
    .select('id')
    .eq('nullifier_hash', nullifier_hash)
    .maybeSingle()

  if (usedNullifier) {
    return NextResponse.json({ error: 'World ID ya usado' }, { status: 400 })
  }

  // 5. Insertar miembro
  const newPosition = circle.member_count
  const { error: insertError } = await supabaseAdmin
    .from('circle_members')
    .insert({
      circle_id: circleId,
      wallet,
      position: newPosition,
      nullifier_hash,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // 6. Actualizar member_count
  const newCount = circle.member_count + 1
  const newStatus = newCount >= circle.max_members ? 'active' : 'open'

  await supabaseAdmin
    .from('circles')
    .update({
      member_count: newCount,
      status: newStatus,
      ...(newStatus === 'active' ? { cycle_start_time: new Date().toISOString() } : {}),
    })
    .eq('id', circleId)

  await supabaseAdmin.from('reputation_events').insert({
    wallet,
    circle_id: circleId,
    event_type: 'joined',
  })

  return NextResponse.json({ success: true, position: newPosition, circleStatus: newStatus })
}
