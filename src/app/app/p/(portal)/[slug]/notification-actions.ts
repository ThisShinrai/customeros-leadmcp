'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { clientUsers } from '@/lib/db';
import { requirePortalSession } from '@/lib/auth/session';

const FreqSchema = z.enum(['sofort', 'nie']);

/** The client toggles whether they receive portal notification emails. */
export async function updateClientEmailFrequency(frequency: string): Promise<{ ok: true }> {
  const s = await requirePortalSession();
  const freq = FreqSchema.parse(frequency);
  const db = await getRequestDb();
  await db.update(clientUsers).set({ emailFrequency: freq, updatedAt: new Date() }).where(eq(clientUsers.id, s.client.id));
  revalidatePath(`/app/p/${s.agency.slug}/profil`);
  return { ok: true };
}
