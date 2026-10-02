'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { agencies } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';

/**
 * Paid add-on toggle: hide in-app promos/ads for the whole team.
 * Persisted on agencies.teamAdsDisabled (tenant-scoped by session.agencyId).
 */
export async function setTeamAdsDisabled(disabled: boolean) {
  const session = await requireAgencySession();
  assertCan(session, 'settings:whitelabel');

  const db = await getRequestDb();
  await db
    .update(agencies)
    .set({ teamAdsDisabled: disabled, updatedAt: new Date() })
    .where(eq(agencies.id, session.agencyId));

  revalidatePath('/app/a/settings');
  revalidatePath('/app/a/dashboard');
  return { ok: true };
}
