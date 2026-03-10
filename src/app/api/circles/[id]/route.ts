import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

  return NextResponse.json({ circle, members: members ?? [] })
}
