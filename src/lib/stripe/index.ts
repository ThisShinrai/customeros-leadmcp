import Stripe from 'stripe';
import { getRequestEnv } from '@/lib/db';
import { PLAN_LIMITS, type Plan } from '@/lib/plans';

let cached: Stripe | null = null;

async function keys() {
  const env = await getRequestEnv();
  const secret = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
  const webhook = env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
  return { secret, webhook };
}

export async function isStripeConfigured(): Promise<boolean> {
  const { secret } = await keys();
  return secret.startsWith('sk_') && !secret.includes('placeholder');
}

async function getStripe(): Promise<Stripe | null> {
  const { secret } = await keys();
  if (!secret.startsWith('sk_') || secret.includes('placeholder')) return null;
  if (cached) return cached;
  // Fetch-based HTTP client → works on the Cloudflare Workers / Edge runtime.
  cached = new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() });
  return cached;
}

export async function createCheckoutSession(opts: {
  plan: Plan;
  agencyId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const limits = PLAN_LIMITS[opts.plan];
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: opts.customerEmail,
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: `epssys ${limits.label}` },
        unit_amount: limits.priceEur * 100,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: { agencyId: opts.agencyId, plan: opts.plan },
    subscription_data: { metadata: { agencyId: opts.agencyId, plan: opts.plan } },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return session.url;
}

/** One-off Checkout Session (hosted redirect) to pay a single invoice. */
export async function createInvoiceCheckoutSession(opts: {
  invoiceId: string;
  agencyId: string;
  amountCents: number;
  description: string;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null; id: string } | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.customerEmail || undefined,
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: opts.description.slice(0, 250) || 'Rechnung' },
        unit_amount: opts.amountCents,
      },
      quantity: 1,
    }],
    payment_intent_data: { metadata: { invoiceId: opts.invoiceId, agencyId: opts.agencyId } },
    metadata: { invoiceId: opts.invoiceId, agencyId: opts.agencyId, kind: 'invoice' },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return { url: session.url, id: session.id };
}

export async function constructWebhookEvent(body: string, signature: string): Promise<Stripe.Event | null> {
  const stripe = await getStripe();
  const { webhook } = await keys();
  if (!stripe || !webhook || webhook.includes('placeholder')) return null;
  // Async variant uses Web Crypto (Edge-safe).
  return stripe.webhooks.constructEventAsync(body, signature, webhook);
}
