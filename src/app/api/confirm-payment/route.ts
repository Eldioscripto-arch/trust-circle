import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { payload } = await req.json();

  const { data: ref } = await supabaseAdmin
    .from('payment_references')
    .select('id, wallet')
    .eq('id', payload.reference)
    .maybeSingle();

  if (!ref) {
    return NextResponse.json({ success: false, error: 'Reference not found' });
  }

  const response = await fetch(
    `https://developer.worldcoin.org/api/v2/minikit/transaction/${payload.transaction_id}?app_id=${process.env.NEXT_PUBLIC_APP_ID}&type=payment`,
    {
      headers: {
        Authorization: `Bearer ${process.env.DEV_PORTAL_API_KEY}`,
      },
    }
  );
  const transaction = await response.json();

  if (transaction.reference === ref.id && transaction.transaction_status !== 'failed') {
    await supabaseAdmin
      .from('payment_references')
      .update({ status: 'confirmed' })
      .eq('id', ref.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false });
}
