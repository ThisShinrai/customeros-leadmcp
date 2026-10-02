'use server';

import { and, eq } from 'drizzle-orm';
import { getRequestDb, getRequestEnv } from '@/lib/db';
import { invoices } from '@/lib/db';
import { requirePortalSession } from '@/lib/auth/session';
import { createInvoiceCheckoutSession } from '@/lib/stripe';

type PayResult = { url: string } | { error: string };

/**
 * Start a Stripe Checkout (hosted redirect) to pay a released invoice.
 * Tenant-safe: the invoice must belong to the calling client's agency AND
 * be assigned to that client, be visible, unpaid, and have a positive total.
 */
export async function payInvoice(invoiceId: string): Promise<PayResult> {
  const session = await requirePortalSession();
  const db = await getRequestDb();

  const inv = await db.query.invoices.findFirst({
    where: and(
      eq(invoices.id, invoiceId),
      eq(invoices.agencyId, session.agencyId),
      eq(invoices.clientId, session.client.id),
    ),
  });
  if (!inv) return { error: 'NOT_FOUND' };
  if (!inv.visibleToClient) return { error: 'NOT_AVAILABLE' };
  if (inv.status === 'paid') return { error: 'ALREADY_PAID' };
  if (inv.totalAmount <= 0) return { error: 'INVALID_AMOUNT' };

  const env = await getRequestEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://c.epssys.de';
  const base = `${appUrl}/app/p/${session.agency.slug}/rechnungen`;

  const result = await createInvoiceCheckoutSession({
    invoiceId: inv.id,
    agencyId: inv.agencyId,
    amountCents: inv.totalAmount,
    description: `Rechnung ${inv.invoiceNumber || ''} — ${inv.title}`.trim(),
    customerEmail: session.client.email,
    successUrl: `${base}/${inv.id}?bezahlt=1`,
    cancelUrl: `${base}/${inv.id}`,
  });
  if (!result) return { error: 'STRIPE_OFF' };

  // Correlate the session for reconciliation / webhook fallback.
  await db.update(invoices).set({ stripeCheckoutSessionId: result.id, updatedAt: new Date() }).where(eq(invoices.id, inv.id));

  if (!result.url) return { error: 'NO_URL' };
  return { url: result.url };
}
