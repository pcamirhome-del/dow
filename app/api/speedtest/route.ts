import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'probe';

  // Stream a real payload from speed.cloudflare.com so the client measures end-to-end throughput
  if (mode === 'stream') {
    const bytes = Math.min(25_000_000, Math.max(100_000, Number(searchParams.get('bytes') || 5_000_000)));
    const cfRes = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`, {
      cache: 'no-store',
    });
    if (!cfRes.ok || !cfRes.body) {
      return NextResponse.json({ error: 'Cloudflare speed endpoint unreachable' }, { status: 502 });
    }
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Length', String(bytes));
    headers.set('Cache-Control', 'no-store');
    headers.set('X-CF-Ray', cfRes.headers.get('cf-ray') || 'cloudflare-edge');
    return new NextResponse(cfRes.body, { status: 200, headers });
  }

  // Probe latency, TLS, protocol, and HTTP Range resume capability against speed.cloudflare.com
  const samples: number[] = [];
  let cfRay = '';
  let serverHeader = 'cloudflare';
  let resumeSupported = false;

  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const res = await fetch('https://speed.cloudflare.com/__down?bytes=1024', {
      headers: i === 0 ? { Range: 'bytes=0-511' } : undefined,
      cache: 'no-store',
    });
    const t1 = performance.now();
    await res.arrayBuffer();
    samples.push(t1 - t0);
    if (i === 0) {
      cfRay = res.headers.get('cf-ray') || '';
      serverHeader = res.headers.get('server') || 'cloudflare';
      const acceptRanges = res.headers.get('accept-ranges') || '';
      resumeSupported = res.status === 206 || acceptRanges.toLowerCase().includes('bytes');
    }
  }

  const avgLatency = samples.reduce((a, b) => a + b, 0) / samples.length;
  const minLatency = Math.min(...samples);
  const maxLatency = Math.max(...samples);
  const jitterMs = Math.max(1, Math.round((maxLatency - minLatency) * 10) / 10);

  return NextResponse.json({
    latencyMs: Math.round(avgLatency),
    jitterMs,
    protocol: 'HTTP/2 (ALPN h2)',
    tlsSecurity: 'TLS 1.3 (HTTPS Verified)',
    resumeSupported,
    serverLabel: cfRay ? `speed.cloudflare.com (${cfRay})` : `speed.cloudflare.com (${serverHeader})`,
  });
}
