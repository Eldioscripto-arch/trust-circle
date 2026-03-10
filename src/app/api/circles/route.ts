import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.name) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const wallet = session.user.name.toLowerCase()

  const { data, error } = await supabaseAdmin
    .from('circle_members')
    .select('circle_id, position, circles(*)')
    .eq('wallet', wallet)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ circles: data })
}
