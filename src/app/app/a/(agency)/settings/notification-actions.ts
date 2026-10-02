'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { agencyUsers } from '@/lib/db';
import { requireAgencySession } from '@/lib/auth/session';

const FreqSchema = z.enum(['sofort', 'nie']);

/** The current agency user sets their own email-notification preference. */
export async function updateEmailFrequency(frequency: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  const freq = FreqSchema.parse(frequency);
  const db = await getRequestDb();
  await db.update(agencyUsers).set({ emailFrequency: freq, updatedAt: new Date() }).where(eq(agencyUsers.id, s.user.id));
  revalidatePath('/app/a/settings');
  return { ok: true };
}
