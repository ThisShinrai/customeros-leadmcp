'use server';

import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { proposals, proposalItems, type Proposal } from '@/lib/db';
import { requirePortalSession } from '@/lib/auth/session';
import { computeTotals, type InvoiceTotals, type InvoiceDocItem } from '@/lib/invoices/format';
import { logAudit } from '@/lib/audit';
import { dispatchWebhook } from '@/lib/webhooks';

export interface ClientProposalListItem {
  id: string; number: string | null; title: string; status: Proposal['status'];
  totalAmount: number; validUntil: Date | null; createdAt: Date | null;
}

/** Proposals the logged-in client may see (everything except drafts). */
export async function getClientProposals(): Promise<ClientProposalListItem[]> {
  const s = await requirePortalSession();
  const db = await getRequestDb();
  const rows = await db.select().from(proposals)
    .where(and(eq(proposals.clientId, s.client.id), ne(proposals.status, 'draft')))
    .orderBy(desc(proposals.createdAt));
  return rows.map((r) => ({ id: r.id, number: r.number, title: r.title, status: r.status, totalAmount: r.totalAmount, validUntil: r.validUntil, createdAt: r.createdAt }));
}

export interface ClientProposalDetail {
  proposal: Proposal;
  items: InvoiceDocItem[];
  totals: InvoiceTotals;
}

/** One proposal for the client; marks it "viewed" on first open. */
export async function getClientProposalDetail(id: string): Promise<ClientProposalDetail | null> {
  const s = await requirePortalSession();
  const db = await getRequestDb();
  const p = await db.query.proposals.findFirst({ where: and(eq(proposals.id, id), eq(proposals.clientId, s.client.id)) });
  if (!p || p.status === 'draft') return null;
  if (p.status === 'sent') {
    await db.update(proposals).set({ status: 'viewed', viewedAt: new Date() }).where(eq(proposals.id, id));
    p.status = 'viewed';
  }
  const rows = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, id)).orderBy(asc(proposalItems.sortOrder));
  const items: InvoiceDocItem[] = rows.map((it) => ({ description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate }));
  return { proposal: p, items, totals: computeTotals(items) };
}

/** Simple electronic signature: typed name + consent → captures name, time, IP. */
export async function signProposal(id: string, signerName: string): Promise<{ ok: true }> {
  const s = await requirePortalSession();
  const db = await getRequestDb();
  const p = await db.query.proposals.findFirst({ where: and(eq(proposals.id, id), eq(proposals.clientId, s.client.id)) });
  if (!p) throw new Error('NOT_FOUND');
  if (p.status === 'signed') return { ok: true };
  if (p.status === 'draft' || p.status === 'declined') throw new Error('FORBIDDEN');
  const name = String(signerName || '').trim().slice(0, 120);
  if (!name) throw new Error('Name erforderlich');
  const ip = (await headers()).get('cf-connecting-ip') ?? null;
  await db.update(proposals).set({ status: 'signed', signedAt: new Date(), signerName: name, signerIp: ip, updatedAt: new Date() }).where(eq(proposals.id, id));
  await logAudit(db, { agencyId: s.agencyId, actorId: s.client.id, actorName: name, action: 'proposal.signed', targetType: 'proposal', targetId: id, meta: { ip } });
  await dispatchWebhook(db, s.agencyId, 'proposal.signed', { id, signerName: name });
  revalidatePath(`/app/p/${s.agency.slug}/angebote`);
  return { ok: true };
}

export async function declineProposal(id: string): Promise<{ ok: true }> {
  const s = await requirePortalSession();
  const db = await getRequestDb();
  const p = await db.query.proposals.findFirst({ where: and(eq(proposals.id, id), eq(proposals.clientId, s.client.id)) });
  if (!p) throw new Error('NOT_FOUND');
  if (p.status === 'signed') throw new Error('Bereits unterschrieben.');
  await db.update(proposals).set({ status: 'declined', declinedAt: new Date(), updatedAt: new Date() }).where(eq(proposals.id, id));
  await logAudit(db, { agencyId: s.agencyId, actorId: s.client.id, actorName: s.client.name, action: 'proposal.declined', targetType: 'proposal', targetId: id });
  revalidatePath(`/app/p/${s.agency.slug}/angebote`);
  return { ok: true };
}
