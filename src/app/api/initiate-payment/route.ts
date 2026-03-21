import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uuid = crypto.randomUUID().replace(/-/g, '');
  const wallet = session.user.id.toLowerCase();

  await supabaseAdmin.from('payment_references').insert({
    id: uuid,
    wallet,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ id: uuid });
}
