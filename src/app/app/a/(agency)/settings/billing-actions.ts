'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { agencies } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { createCheckoutSession, isStripeConfigured } from '@/lib/stripe';
import type { Plan } from '@/lib/plans';

export async function startCheckout(plan: Plan): Promise<{ url?: string; configured: boolean }> {
  const session = await requireAgencySession();
  assertCan(session, 'settings:billing');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Downgrade to free is handled directly (no payment needed).
  if (plan === 'free') {
    const db = await getRequestDb();
    await db.update(agencies).set({ plan: 'free', updatedAt: new Date() }).where(eq(agencies.id, session.agencyId));
    revalidatePath('/app/a/settings');
    return { configured: true };
  }

  if (!(await isStripeConfigured())) return { configured: false };

  const url = await createCheckoutSession({
    plan,
    agencyId: session.agencyId,
    customerEmail: session.user.email,
    successUrl: `${appUrl}/app/a/settings?billing=success`,
    cancelUrl: `${appUrl}/app/a/settings?billing=cancel`,
  });
  return { url: url ?? undefined, configured: true };
}
