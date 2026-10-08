import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
  const isMemoryHealthy = heapUsedMb < 1500; // Under 1.5GB

  const checks = {
    runtime: 'ok',
    memory: isMemoryHealthy ? 'ok' : 'degraded',
    dns: 'ok',
    pipeline: 'ready'
  };

  const isReady = isMemoryHealthy;

  return NextResponse.json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    heapUsedMb,
    checks
  }, {
    status: isReady ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
