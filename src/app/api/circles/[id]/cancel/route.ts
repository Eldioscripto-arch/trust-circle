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

  const { data: circle, error } = await supabaseAdmin
    .from('circles')
    .select('creator_wallet, status')
    .eq('id', id)
    .single()

  if (error || !circle) {
    return NextResponse.json({ error: 'Círculo no encontrado' }, { status: 404 })
  }

  if (circle.creator_wallet.toLowerCase() !== wallet) {
    return NextResponse.json({ error: 'Solo el creador puede cancelar' }, { status: 403 })
  }

  if (circle.status !== 'open') {
    return NextResponse.json({ error: 'Solo se pueden cancelar círculos abiertos' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('circles')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
