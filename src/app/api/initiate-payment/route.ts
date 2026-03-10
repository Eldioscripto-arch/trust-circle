import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uuid = crypto.randomUUID().replace(/-/g, '');

  return NextResponse.json({ id: uuid });
}
