import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { agencies } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { constructWebhookEvent } from '@/lib/stripe';
import { markInvoicePaid } from '@/lib/invoices/mark-paid';
import type { Plan } from '@/lib/plans';

export async function POST(req: Request) {
  const db = await getRequestDb();

  // Sanity throttle per source IP — never interferes with signature checks below.
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  const { allowed, retryAfter } = await checkRateLimit(db, `stripe-webhook:${ip}`, {
    limit: 100,
    windowSec: 60,
  });
  if (!allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('No signature', { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = await constructWebhookEvent(body, signature);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }
  if (!event) return new Response('Stripe not configured', { status: 200 });

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object as {
      id?: string; payment_status?: string; metadata?: Record<string, string>;
      customer?: string; subscription?: string;
    };
    const invoiceId = s.metadata?.invoiceId;
    if (invoiceId) {
      // One-off invoice payment. Card sessions are already `paid` on completion;
      // delayed methods (SEPA) settle later via async_payment_succeeded.
      const settled = event.type === 'checkout.session.async_payment_succeeded' || s.payment_status === 'paid';
      if (settled) await markInvoicePaid(db, invoiceId, { checkoutSessionId: s.id ?? null });
    } else {
      // Subscription billing (agency plan).
      const agencyId = s.metadata?.agencyId;
      const plan = s.metadata?.plan as Plan | undefined;
      if (agencyId && plan) {
        await db.update(agencies).set({
          plan, stripeCustomerId: s.customer ?? null, stripeSubscriptionId: s.subscription ?? null, updatedAt: new Date(),
        }).where(eq(agencies.id, agencyId));
      }
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { metadata?: Record<string, string> };
    const agencyId = sub.metadata?.agencyId;
    if (agencyId) await db.update(agencies).set({ plan: 'free', updatedAt: new Date() }).where(eq(agencies.id, agencyId));
  } else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as { metadata?: Record<string, string> };
    const agencyId = sub.metadata?.agencyId;
    const plan = sub.metadata?.plan as Plan | undefined;
    if (agencyId && plan) await db.update(agencies).set({ plan, updatedAt: new Date() }).where(eq(agencies.id, agencyId));
  }

  return new Response('ok', { status: 200 });
}
