import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Cliente público (frontend)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente admin (backend/API routes únicamente)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Tipos principales
export type Circle = {
  id: string
  chain_id: number | null
  name: string
  creator_wallet: string
  contribution_amount: number
  cycle_duration_seconds: number
  max_members: number
  member_count: number
  current_cycle: number
  is_public: boolean
  invite_code: string | null
  status: 'open' | 'active' | 'completed' | 'cancelled'
  cycle_start_time: string | null
  created_at: string
}

export type CircleMember = {
  id: string
  circle_id: string
  wallet: string
  position: number
  joined_at: string
}

export type CyclePayment = {
  id: string
  circle_id: string
  cycle_index: number
  wallet: string
  amount: number
  tx_hash: string | null
  status: 'pending' | 'confirmed' | 'failed'
  paid_at: string | null
}
