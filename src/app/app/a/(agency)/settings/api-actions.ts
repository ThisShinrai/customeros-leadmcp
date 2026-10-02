'use server';

import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { apiKeys } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { generateApiKey } from '@/lib/api-keys';

export interface ApiKeyListItem {
  id: string; name: string; prefix: string;
  lastUsedAt: Date | null; revokedAt: Date | null; createdAt: Date | null;
}

export async function listApiKeys(): Promise<ApiKeyListItem[]> {
  const s = await requireAgencySession();
  assertCan(s, 'settings:profile');
  const db = await getRequestDb();
  return db.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys).where(eq(apiKeys.agencyId, s.agencyId)).orderBy(desc(apiKeys.createdAt));
}

/** Returns the raw key ONCE — never retrievable again. */
export async function createApiKey(name: string): Promise<{ key: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'settings:profile');
  const safe = z.string().trim().min(1, 'Name erforderlich').max(60).parse(name);
  const { key, hash, prefix } = await generateApiKey();
  const db = await getRequestDb();
  await db.insert(apiKeys).values({ agencyId: s.agencyId, name: safe, keyHash: hash, prefix });
  revalidatePath('/app/a/settings');
  return { key };
}

export async function revokeApiKey(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'settings:profile');
  const db = await getRequestDb();
  const row = await db.query.apiKeys.findFirst({ where: and(eq(apiKeys.id, id), eq(apiKeys.agencyId, s.agencyId)) });
  if (!row) throw new Error('NOT_FOUND');
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  revalidatePath('/app/a/settings');
  return { ok: true };
}
