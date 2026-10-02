import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { agencies, agencyUsers, clientUsers, proposals } from '@/lib/db';
import { sendEmail } from './send';
import { magicLinkEmail, clientInviteEmail, teamInviteEmail, proposalEmail } from './templates';
import { fmtEuro, fmtDate } from '@/lib/invoices/format';
import { ROLE_LABELS, type AgencyRole } from '@/lib/permissions';

/**
 * Context-aware magic-link sender. Picks the right branded template based on
 * whether the recipient is a pending client invite, a pending team invite, or
 * an existing user just signing in.
 */
export async function sendContextualMagicLink(db: Db, { to, url }: { to: string; url: string }) {
  const email = to.toLowerCase();

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n🔗 [Magic Link] ${email}\n   ${url}\n`);
  }

  let payload: { subject: string; html: string };

  const client = await db.query.clientUsers.findFirst({ where: eq(clientUsers.email, email) });

  // Angebots-Versand: sendProposal schickt den Magic-Link mit callbackURL …/angebote —
  // dann bekommt der Kunde die Angebots-Mail mit Titel, Nummer, Betrag und CTA.
  const callback = (() => { try { return new URL(url).searchParams.get('callbackURL') ?? ''; } catch { return ''; } })();
  if (client && callback.includes('/angebote')) {
    const [agency, proposal] = await Promise.all([
      db.query.agencies.findFirst({ where: eq(agencies.id, client.agencyId) }),
      db.query.proposals.findFirst({
        where: and(eq(proposals.clientId, client.id), eq(proposals.status, 'sent')),
        orderBy: [desc(proposals.sentAt)],
      }),
    ]);
    if (proposal) {
      const { subject, html } = proposalEmail({
        url,
        agencyName: agency?.name ?? 'Ihre Agentur',
        accentColor: agency?.accentColor ?? undefined,
        clientName: client.name,
        title: proposal.title,
        number: proposal.number,
        totalFormatted: fmtEuro(proposal.totalAmount),
        validUntilFormatted: proposal.validUntil ? fmtDate(proposal.validUntil) : null,
      });
      await sendEmail({ to: email, subject, html, ...(agency?.contactEmail ? { replyTo: agency.contactEmail } : {}) });
      return;
    }
  }

  if (client) {
    const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, client.agencyId) });
    payload = clientInviteEmail({ url, agencyName: agency?.name ?? 'Ihr Portal', accentColor: agency?.accentColor ?? undefined, clientName: client.name });
  } else {
    const member = await db.query.agencyUsers.findFirst({ where: eq(agencyUsers.email, email) });
    if (member && member.status === 'invited') {
      const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, member.agencyId) });
      payload = teamInviteEmail({ url, agencyName: agency?.name ?? 'epssys', accentColor: agency?.accentColor ?? undefined, roleLabel: ROLE_LABELS[member.role as AgencyRole] ?? 'Mitglied' });
    } else {
      payload = magicLinkEmail(url);
    }
  }

  await sendEmail({ to: email, subject: payload.subject, html: payload.html });
}

/** Legacy entry kept for compatibility (no db context). */
export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n🔗 [Magic Link] ${to}\n   ${url}\n`);
  }
  const { subject, html } = magicLinkEmail(url);
  await sendEmail({ to, subject, html });
}
