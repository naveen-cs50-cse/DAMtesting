import { NextRequest, NextResponse } from 'next/server';
import { getWatchtowerFeed } from '@/lib/investigation/watchtower';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'All';

    const items = getWatchtowerFeed(query, category);

    return NextResponse.json({
      success: true,
      count: items.length,
      timestamp: new Date().toISOString(),
      feed: items
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
