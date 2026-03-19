import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('circles')
    .select('id, name, creator_wallet, contribution_amount, cycle_duration_seconds, max_members, member_count, status, is_public, created_at, token')
    .eq('is_public', true)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ circles: data ?? [] })
}
