import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = session.user.id.toLowerCase()

  const { data, error } = await supabaseAdmin
    .from('circle_members')
    .select('circle_id, position, joined_at, circles(name, status, contribution_amount, token, max_members)')
    .eq('wallet', wallet)
    .order('joined_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}
