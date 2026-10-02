'use server';

import { requireAgencySession } from '@/lib/auth/session';
import { getProposalDetail } from './queries';
import { fmtEuro, fmtDate } from '@/lib/invoices/format';
import type { ProposalStatus } from './queries';

/**
 * Client-callable wrapper around the server-only `getProposalDetail` read.
 * Returns a flat, serialisable payload (dates → strings) so the detail Drawer
 * in `proposals-view.tsx` can lazy-load the full document (intro, items table,
 * totals, signature) on row click without exposing the raw Drizzle query.
 */
export interface ProposalDetailPayload {
  id: string;
  number: string | null;
  title: string;
  status: ProposalStatus;
  intro: string | null;
  clientName: string;
  validUntil: string | null;
  signedAt: string | null;
  signerName: string | null;
  items: { description: string; quantity: number; unitPriceEuro: string; taxRate: number; lineTotalEuro: string }[];
  netEuro: string;
  taxEuro: string;
  grossEuro: string;
}

export async function loadProposalDetail(id: string): Promise<ProposalDetailPayload | null> {
  const s = await requireAgencySession();
  const d = await getProposalDetail(id, s.agencyId);
  if (!d) return null;
  return {
    id: d.proposal.id,
    number: d.proposal.number,
    title: d.proposal.title,
    status: d.proposal.status,
    intro: d.proposal.intro,
    clientName: d.clientName,
    validUntil: d.proposal.validUntil ? fmtDate(d.proposal.validUntil) : null,
    signedAt: d.proposal.signedAt ? fmtDate(d.proposal.signedAt) : null,
    signerName: d.proposal.signerName,
    items: d.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPriceEuro: fmtEuro(it.unitPriceCents),
      taxRate: it.taxRate,
      lineTotalEuro: fmtEuro(Math.round(it.quantity * it.unitPriceCents)),
    })),
    netEuro: fmtEuro(d.totals.netCents),
    taxEuro: fmtEuro(d.totals.taxCents),
    grossEuro: fmtEuro(d.totals.grossCents),
  };
}
