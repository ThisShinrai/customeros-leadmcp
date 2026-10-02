'use server';

import { eq } from 'drizzle-orm';
import { getRequestDb, getRequestEnv } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';

export async function getVapidPublicKey(): Promise<string | null> {
  const env = (await getRequestEnv()) as unknown as { VAPID_PUBLIC?: string };
  return env.VAPID_PUBLIC || process.env.VAPID_PUBLIC || null;
}

export async function savePushSubscription(sub: { endpoint: string; keys?: { p256dh?: string; auth?: string } }): Promise<{ ok: boolean }> {
  const s = await getEnrichedSession();
  if (!s) return { ok: false };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  const userId = s.kind === 'agency' ? s.user.id : s.client.id;
  const userType = s.kind === 'agency' ? ('agency_user' as const) : ('client_user' as const);
  const db = await getRequestDb();
  const existing = await db.query.pushSubscriptions.findFirst({ where: eq(pushSubscriptions.endpoint, sub.endpoint) });
  if (existing) {
    await db.update(pushSubscriptions).set({ userId, userType, agencyId: s.agencyId, p256dh: sub.keys.p256dh, auth: sub.keys.auth }).where(eq(pushSubscriptions.id, existing.id));
  } else {
    await db.insert(pushSubscriptions).values({ agencyId: s.agencyId, userId, userType, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  }
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const s = await getEnrichedSession();
  if (!s || !endpoint) return { ok: false };
  const db = await getRequestDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return { ok: true };
}
