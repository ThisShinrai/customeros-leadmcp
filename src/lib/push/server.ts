import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db';
import { getRequestEnv } from '@/lib/db';
import { sendPush, type VapidKeys } from './web-push';

async function getVapid(): Promise<VapidKeys | null> {
  const env = (await getRequestEnv()) as unknown as { VAPID_PUBLIC?: string; VAPID_PRIVATE?: string; VAPID_SUBJECT?: string };
  const publicKey = env.VAPID_PUBLIC || process.env.VAPID_PUBLIC || '';
  const priv = env.VAPID_PRIVATE || process.env.VAPID_PRIVATE || '';
  if (!publicKey || !priv) return null;
  let privateJwk: JsonWebKey;
  try { privateJwk = JSON.parse(priv) as JsonWebKey; } catch { return null; }
  return { publicKey, privateJwk, subject: env.VAPID_SUBJECT || 'mailto:contact@epssys.de' };
}

export interface PushPayload { title: string; body: string; url?: string }

/**
 * Best-effort web push to every device of a user. Dead subscriptions (404/410)
 * are pruned. No-ops silently when VAPID isn't configured (dormant, like email).
 */
export async function sendPushToUser(db: Db, userId: string, userType: 'agency_user' | 'client_user', payload: PushPayload): Promise<void> {
  try {
    const vapid = await getVapid();
    if (!vapid) return;
    const subs = await db.select().from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.userType, userType)));
    if (subs.length === 0) return;
    const json = JSON.stringify(payload);
    await Promise.all(subs.map(async (s) => {
      try {
        const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, json, vapid);
        if (r.status === 404 || r.status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      } catch { /* per-subscription best effort */ }
    }));
  } catch { /* never throw into the caller */ }
}
