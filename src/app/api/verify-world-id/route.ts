import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { wallet, proof, merkle_root, nullifier_hash, verification_level } = await req.json()

  if (!proof || !merkle_root || !nullifier_hash) {
    return NextResponse.json({ error: 'Faltan datos del proof' }, { status: 400 })
  }

  // Verificar con World ID API
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

  // Verificar nullifier no usado por otra wallet
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('wallet_address')
    .eq('world_id_nullifier', nullifier_hash)
    .maybeSingle()

  if (existing && existing.wallet_address !== wallet) {
    return NextResponse.json(
      { error: 'Este World ID ya está vinculado a otra wallet' },
      { status: 400 }
    )
  }

  // Guardar verificación en users
  await supabaseAdmin
    .from('users')
    .update({
      world_id_nullifier: nullifier_hash,
      world_id_verified: true,
    })
    .eq('wallet_address', wallet)

  return NextResponse.json({ success: true })
}
