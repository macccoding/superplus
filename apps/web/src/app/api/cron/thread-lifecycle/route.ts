import { NextResponse } from 'next/server';
import { db } from '@superplus/db';
import { runThreadLifecycle } from '@/server/thread-lifecycle';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runThreadLifecycle(db);
  return NextResponse.json({ ok: true, ...result });
}
