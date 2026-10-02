import { asc, eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { invoices, invoiceItems, agencies, clientUsers } from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';
import { buildCiiXml, eInvoiceFilename } from '@/lib/einvoice/cii';
import type { EInvoiceData } from '@/lib/einvoice/types';

/** EN 16931 / ZUGFeRD CII e-invoice (machine-readable XML) for one invoice. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getEnrichedSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const db = await getRequestDb();
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!invoice) return new Response('Not Found', { status: 404 });

  const allowed =
    (session.kind === 'agency' && invoice.agencyId === session.agencyId) ||
    (session.kind === 'client' && invoice.clientId === session.client.id && invoice.visibleToClient);
  if (!allowed) return new Response('Forbidden', { status: 403 });

  const [agency, client, items] = await Promise.all([
    db.query.agencies.findFirst({ where: eq(agencies.id, invoice.agencyId) }),
    db.query.clientUsers.findFirst({ where: eq(clientUsers.id, invoice.clientId) }),
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id)).orderBy(asc(invoiceItems.sortOrder)),
  ]);
  if (!agency || !client) return new Response('Not Found', { status: 404 });

  const data: EInvoiceData = {
    invoiceNumber: invoice.invoiceNumber || invoice.id,
    issueDate: invoice.createdAt ?? new Date(),
    dueDate: invoice.dueDate ?? null,
    currency: 'EUR',
    note: invoice.notes ?? undefined,
    seller: {
      name: agency.name,
      street: agency.street ?? undefined,
      zip: agency.zip ?? undefined,
      city: agency.city ?? undefined,
      countryCode: agency.country || 'DE',
      vatId: agency.taxId ?? undefined,
      email: agency.contactEmail ?? undefined,
      iban: agency.iban ?? undefined,
      bic: agency.bic ?? undefined,
    },
    buyer: {
      name: client.company || client.name,
      street: client.street ?? undefined,
      zip: client.zip ?? undefined,
      city: client.city ?? undefined,
      countryCode: client.country || 'DE',
      vatId: client.vatId ?? undefined,
      email: client.email ?? undefined,
    },
    lines: items.map((it, i) => ({
      id: String(i + 1),
      name: it.description,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      taxRatePercent: it.taxRate,
    })),
  };

  const xml = buildCiiXml(data);
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${eInvoiceFilename(data.invoiceNumber)}"`,
    },
  });
}
