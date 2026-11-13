import { NextRequest, NextResponse } from 'next/server';
import { validatePublicHttpUrl } from '@/lib/url-safety';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get('url');
    const filename = searchParams.get('filename') || 'media.mp4';

    if (!rawUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    const parsedUrl = validatePublicHttpUrl(rawUrl);

    const forwardHeaders: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      forwardHeaders['Range'] = rangeHeader;
    }

    const upstream = await fetch(parsedUrl.toString(), {
      headers: forwardHeaders,
      redirect: 'follow',
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream media error (${upstream.status})` },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    headers.set('Content-Type', contentType);

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);

    headers.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
    headers.set('Cache-Control', 'no-store');

    const safeFilename = filename.replace(/[\r\n"\\]/g, '_');
    headers.set(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
    );

    return new NextResponse(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream proxy error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
