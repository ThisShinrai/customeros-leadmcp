import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { invoices } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { dispatchWebhook } from '@/lib/webhooks';

/**
 * Mark an invoice paid from a session-less context (Stripe webhook). Idempotent:
 * a no-op if the invoice is already paid or missing. Mirrors the side-effects of
 * the agency-initiated `setInvoiceStatus(id, 'paid')` — audit entry + the
 * outbound `invoice.paid` webhook — but derives the agency from the invoice row
 * itself (the caller has no session).
 */
export async function markInvoicePaid(
  db: Db,
  invoiceId: string,
  opts?: { checkoutSessionId?: string | null },
): Promise<void> {
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!inv || inv.status === 'paid') return;

  await db.update(invoices).set({
    status: 'paid',
    paidAt: new Date(),
    stripeCheckoutSessionId: opts?.checkoutSessionId ?? inv.stripeCheckoutSessionId ?? null,
    updatedAt: new Date(),
  }).where(eq(invoices.id, invoiceId));

  await logAudit(db, {
    agencyId: inv.agencyId,
    actorId: null,
    actorName: 'Online-Zahlung (Stripe)',
    action: 'invoice.paid',
    targetType: 'invoice',
    targetId: invoiceId,
    meta: { number: inv.invoiceNumber, clientId: inv.clientId, via: 'stripe' },
  });

  await dispatchWebhook(db, inv.agencyId, 'invoice.paid', {
    id: invoiceId, number: inv.invoiceNumber, clientId: inv.clientId,
  });
}
