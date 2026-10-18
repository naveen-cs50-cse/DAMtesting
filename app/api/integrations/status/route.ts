import { NextResponse } from 'next/server';
import { resolvePublicIntegrationStatus } from '@/lib/integrations/destinations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(resolvePublicIntegrationStatus(process.env), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
