import { getRequestDb } from '@/lib/db';
import { createAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { toNextJsHandler } from 'better-auth/next-js';

async function getHandler() {
  const db = await getRequestDb();
  const auth = createAuth(db);
  return toNextJsHandler(auth);
}

export async function GET(req: Request) {
  try {
    const { GET: handler } = await getHandler();
    return handler(req);
  } catch (e) {
    console.error('[auth GET]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Throttle auth POSTs (login, magic-link request, etc.) per client IP.
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    const db = await getRequestDb();
    const { allowed, retryAfter } = await checkRateLimit(db, `auth:${ip}`, {
      limit: 12,
      windowSec: 60,
    });
    if (!allowed) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      });
    }

    const { POST: handler } = await getHandler();
    return handler(req);
  } catch (e) {
    const msg = e instanceof Error ? e.stack ?? e.message : String(e);
    console.error('[auth POST]', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
