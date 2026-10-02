import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { webhookEndpoints } from '@/lib/db';
import { webhookMatches } from '@/lib/webhook-events';

export function genWebhookSecret(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return 'whsec_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fire a signed webhook to every active endpoint of the agency **that
 * subscribes to this event**. Best-effort: never throws into the caller,
 * per-endpoint failures swallowed, 5s timeout.
 * Header `X-Epssys-Signature` = HMAC-SHA256(body, endpoint.secret).
 */
export async function dispatchWebhook(db: Db, agencyId: string, event: string, data: unknown): Promise<void> {
  try {
    const endpoints = await db.select().from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.agencyId, agencyId), eq(webhookEndpoints.active, true)));
    const matching = endpoints.filter((ep) => webhookMatches(ep.events, event));
    if (matching.length === 0) return;
    const body = JSON.stringify({ event, data, timestamp: Date.now() });
    await Promise.all(matching.map(async (ep) => {
      try {
        const signature = await sign(ep.secret, body);
        await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Epssys-Event': event, 'X-Epssys-Signature': signature },
          body,
          signal: AbortSignal.timeout(5000),
        });
      } catch { /* per-endpoint best-effort */ }
    }));
  } catch { /* never throw into the calling mutation */ }
}
