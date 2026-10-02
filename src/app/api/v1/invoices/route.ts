import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { invoices } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api-keys';

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getRequestDb();
  const data = await db.select({ id: invoices.id, number: invoices.invoiceNumber, title: invoices.title, status: invoices.status, totalAmountCents: invoices.totalAmount, dueDate: invoices.dueDate, createdAt: invoices.createdAt })
    .from(invoices).where(eq(invoices.agencyId, auth.agencyId));
  return Response.json({ data });
}
