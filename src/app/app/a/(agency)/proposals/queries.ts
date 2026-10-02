import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { proposals, proposalItems, clientUsers, type Proposal } from '@/lib/db';
import { computeTotals, type InvoiceTotals, type InvoiceDocItem } from '@/lib/invoices/format';

export type ProposalStatus = Proposal['status'];

export interface ProposalListItem {
  id: string;
  number: string | null;
  title: string;
  status: ProposalStatus;
  totalAmount: number;
  clientId: string;
  clientName: string;
  validUntil: Date | null;
  signedAt: Date | null;
  createdAt: Date | null;
}

export async function listProposals(agencyId: string): Promise<ProposalListItem[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(proposals).where(eq(proposals.agencyId, agencyId)).orderBy(desc(proposals.createdAt));
  if (rows.length === 0) return [];
  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const clients = await db.select({ id: clientUsers.id, name: clientUsers.name, company: clientUsers.company })
    .from(clientUsers).where(inArray(clientUsers.id, clientIds));
  const cname = new Map(clients.map((c) => [c.id, c.company || c.name]));
  return rows.map((r) => ({
    id: r.id, number: r.number, title: r.title, status: r.status, totalAmount: r.totalAmount,
    clientId: r.clientId, clientName: cname.get(r.clientId) ?? '—', validUntil: r.validUntil, signedAt: r.signedAt, createdAt: r.createdAt,
  }));
}

export interface ProposalDetail {
  proposal: Proposal;
  items: InvoiceDocItem[];
  totals: InvoiceTotals;
  clientName: string;
  projectName: string | null;
}

export async function getProposalDetail(id: string, agencyId: string): Promise<ProposalDetail | null> {
  const db = await getRequestDb();
  const p = await db.query.proposals.findFirst({ where: and(eq(proposals.id, id), eq(proposals.agencyId, agencyId)) });
  if (!p) return null;
  const rows = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, id)).orderBy(asc(proposalItems.sortOrder));
  const items: InvoiceDocItem[] = rows.map((it) => ({ description: it.description, quantity: it.quantity, unitPriceCents: it.unitPriceCents, taxRate: it.taxRate }));
  const client = await db.query.clientUsers.findFirst({ where: eq(clientUsers.id, p.clientId) });
  return { proposal: p, items, totals: computeTotals(items), clientName: client?.company || client?.name || '—', projectName: null };
}
