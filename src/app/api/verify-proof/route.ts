import {
  ISuccessResult,
  IVerifyResponse,
  verifyCloudProof,
} from '@worldcoin/minikit-js';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

interface IRequestPayload {
  payload: ISuccessResult;
  action: string;
  signal: string | undefined;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 10)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { payload, action, signal } = (await req.json()) as IRequestPayload;
  const app_id = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;

  const verifyRes = (await verifyCloudProof(
    payload,
    app_id,
    action,
    signal,
  )) as IVerifyResponse;

  if (verifyRes.success) {
    return NextResponse.json({ verifyRes, status: 200 });
  } else {
    return NextResponse.json({ verifyRes, status: 400 });
  }
}
