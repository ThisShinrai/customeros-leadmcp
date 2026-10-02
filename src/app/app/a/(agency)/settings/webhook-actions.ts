'use server';

import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { webhookEndpoints } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { genWebhookSecret } from '@/lib/webhooks';
import { normalizeWebhookEvents } from '@/lib/webhook-events';

export interface WebhookListItem {
  id: string; url: string; secret: string; events: string[]; active: boolean; createdAt: Date | null;
}

export async function listWebhooks(): Promise<WebhookListItem[]> {
  const s = await requireAgencySession();
  assertCan(s, 'settings:profile');
  const db = await getRequestDb();
  const rows = await db.select({ id: webhookEndpoints.id, url: webhookEndpoints.url, secret: webhookEndpoints.secret, events: webhookEndpoints.events, active: webhookEndpoints.active, createdAt: webhookEndpoints.createdAt })
    .from(webhookEndpoints).where(eq(webhookEndpoints.agencyId, s.agencyId)).orderBy(desc(webhookEndpoints.createdAt));
  return rows.map((r) => {
    let events: string[];
    try { events = JSON.parse(r.events ?? '["*"]'); } catch { events = ['*']; }
    return { id: r.id, url: r.url, secret: r.secret, events, active: r.active, createdAt: r.createdAt };
  });
}

const UrlSchema = z.string().trim().url('Ungültige URL').max(1000);

export async function createWebhook(url: string, events: string[] = ['*']): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'settings:profile');
  const safeUrl = UrlSchema.parse(url);
  const evs = normalizeWebhookEvents(Array.isArray(events) ? events : ['*']);
  const db = await getRequestDb();
  await db.insert(webhookEndpoints).values({ agencyId: s.agencyId, url: safeUrl, secret: genWebhookSecret(), events: JSON.stringify(evs) });
  revalidatePath('/app/a/settings');
  return { ok: true };
}

export async function updateWebhook(id: string, patch: { url?: string; events?: string[]; active?: boolean }): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'settings:profile');
  const db = await getRequestDb();
  const row = await db.query.webhookEndpoints.findFirst({ where: and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.agencyId, s.agencyId)) });
  if (!row) throw new Error('NOT_FOUND');
  await db.update(webhookEndpoints).set({
    ...(patch.url !== undefined ? { url: UrlSchema.parse(patch.url) } : {}),
    ...(patch.events !== undefined ? { events: JSON.stringify(normalizeWebhookEvents(patch.events)) } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
  }).where(eq(webhookEndpoints.id, id));
  revalidatePath('/app/a/settings');
  return { ok: true };
}

export async function deleteWebhook(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'settings:profile');
  const db = await getRequestDb();
  const row = await db.query.webhookEndpoints.findFirst({ where: and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.agencyId, s.agencyId)) });
  if (!row) throw new Error('NOT_FOUND');
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
  revalidatePath('/app/a/settings');
  return { ok: true };
}
