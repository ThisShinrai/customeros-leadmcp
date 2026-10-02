import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { clientUsers, agencies, agencyUsers } from '@/lib/db';
import { sendEmail } from './send';
import { notificationEmail } from './templates';
import { sendPushToUser } from '@/lib/push/server';

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://c.epssys.de';

/**
 * Best-effort outbound email to a client about a portal event (new invoice,
 * file, etc.) — branded with the agency. Never throws (delivery must not break
 * the calling mutation); silently no-ops in dev / without a Resend key.
 */
export async function notifyClient(db: Db, opts: {
  clientId: string; agencyId: string;
  heading: string; body: string; path: string; ctaLabel?: string;
}): Promise<void> {
  try {
    const client = await db.query.clientUsers.findFirst({ where: eq(clientUsers.id, opts.clientId) });
    if (!client?.email) return;
    if (client.emailFrequency === 'nie') return; // client opted out
    const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, opts.agencyId) });
    const { subject, html } = notificationEmail({
      agencyName: agency?.name,
      accentColor: agency?.accentColor ?? undefined,
      heading: opts.heading,
      body: opts.body,
      url: `${appUrl()}${opts.path}`,
      ctaLabel: opts.ctaLabel,
    });
    await sendEmail({ to: client.email, subject, html, ...(agency?.contactEmail ? { replyTo: agency.contactEmail } : {}) });
    await sendPushToUser(db, opts.clientId, 'client_user', { title: opts.heading, body: opts.body, url: `${appUrl()}${opts.path}` });
  } catch { /* best-effort */ }
}

/**
 * Best-effort outbound email to the agency's contact address about an event
 * (e.g. a client booked an appointment). Never throws; no-ops without a
 * contact email or Resend key.
 */
export async function notifyAgency(db: Db, opts: {
  agencyId: string;
  heading: string; body: string; path: string; ctaLabel?: string;
}): Promise<void> {
  try {
    const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, opts.agencyId) });
    if (!agency?.contactEmail) return;
    // The owner (primary contact) can switch agency notification mails off.
    const owner = await db.query.agencyUsers.findFirst({ where: and(eq(agencyUsers.agencyId, opts.agencyId), eq(agencyUsers.role, 'owner')) });
    if (owner?.emailFrequency === 'nie') return;
    const { subject, html } = notificationEmail({
      agencyName: agency.name,
      accentColor: agency.accentColor ?? undefined,
      heading: opts.heading,
      body: opts.body,
      url: `${appUrl()}${opts.path}`,
      ctaLabel: opts.ctaLabel,
    });
    await sendEmail({ to: agency.contactEmail, subject, html });
    if (owner) await sendPushToUser(db, owner.id, 'agency_user', { title: opts.heading, body: opts.body, url: `${appUrl()}${opts.path}` });
  } catch { /* best-effort */ }
}
