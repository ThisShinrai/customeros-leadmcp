import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { invoices } from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';
import { getObject } from '@/lib/storage/r2';
import { generateInvoicePdf } from '@/lib/invoices/create';

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

  // Self-heal: Positionen-Rechnungen ohne generiertes PDF (z. B. aus einer
  // Angebots-Umwandlung vor dem Fix) werden hier on-demand gerendert.
  let pdfKey = invoice.pdfR2Key;
  if (!pdfKey) {
    try { pdfKey = await generateInvoicePdf(db, invoice.id, invoice.agencyId); } catch { pdfKey = null; }
  }
  if (!pdfKey) return new Response('Not Found', { status: 404 });

  const obj = await getObject(pdfKey);
  if (!obj) return new Response('Not Found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.title}.pdf"`,
    },
  });
}
