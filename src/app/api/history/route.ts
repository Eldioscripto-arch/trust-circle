import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wallet = session.user.id.toLowerCase()

  const { data, error } = await supabaseAdmin
    .from('reputation_events')
    .select('id, circle_id, event_type, created_at, circles(name)')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}
