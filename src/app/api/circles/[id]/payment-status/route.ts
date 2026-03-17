import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const wallet = session.user.id.toLowerCase()
  const { id } = params

  const { data, error } = await supabaseAdmin
    .from('circle_payments')
    .select('id')
    .eq('circle_id', id)
    .eq('wallet', wallet)
    .eq('cycle', 1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ hasPaid: !!data })
}
