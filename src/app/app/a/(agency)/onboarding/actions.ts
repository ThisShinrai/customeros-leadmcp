'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { agencies } from '@/lib/db';
import { requireAgencySession } from '@/lib/auth/session';

const HEX = /^#[0-9a-fA-F]{6}$/;

const CompleteOnboardingSchema = z.object({
  name: z.string().trim().min(1, 'Agenturname erforderlich').max(160),
  accentColor: z.string().trim().regex(HEX, 'Ungültige Farbe'),
});

/** Finish the 3-step wizard: persist name + accent and stamp onboardedAt. */
export async function completeOnboarding(input: unknown) {
  const session = await requireAgencySession();
  const data = CompleteOnboardingSchema.parse(input);
  const db = await getRequestDb();

  await db.update(agencies).set({
    name: data.name,
    accentColor: data.accentColor.toUpperCase(),
    onboardedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(agencies.id, session.agencyId));

  revalidatePath('/app/a/dashboard');
  revalidatePath('/app/a/settings');
  return { ok: true };
}
