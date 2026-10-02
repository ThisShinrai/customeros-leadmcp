import { and, eq, ne, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { invoices, invoiceItems, clientUsers, agencies } from '@/lib/db';
import { getEnrichedSession } from '@/lib/auth/session';
import { buildDatevExtf, datevFilename } from '@/lib/datev/extf';
import type { DatevBooking, DatevMeta } from '@/lib/datev/types';

// SKR03 default revenue accounts by VAT rate (Steuerberater remaps on import).
const ERLOES: Record<number, string> = { 19: '8400', 7: '8300', 0: '8200' };
const DEBITOR = '10000'; // collective customer account

/** DATEV EXTF "Buchungsstapel" export of all non-draft invoices (one booking per VAT rate). */
export async function GET() {
  const session = await getEnrichedSession();
  if (!session || session.kind !== 'agency') return new Response('Unauthorized', { status: 401 });
  const db = await getRequestDb();

  const invs = await db.select().from(invoices)
    .where(and(eq(invoices.agencyId, session.agencyId), ne(invoices.status, 'draft')));

  const bookings: DatevBooking[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  if (invs.length > 0) {
    const ids = invs.map((i) => i.id);
    const clientIds = [...new Set(invs.map((i) => i.clientId))];
    const [items, clients] = await Promise.all([
      db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, ids)),
      db.select({ id: clientUsers.id, name: clientUsers.name, company: clientUsers.company }).from(clientUsers).where(inArray(clientUsers.id, clientIds)),
    ]);
    const itemsByInv = new Map<string, typeof items>();
    for (const it of items) {
      const arr = itemsByInv.get(it.invoiceId) ?? [];
      arr.push(it); itemsByInv.set(it.invoiceId, arr);
    }
    const clientName = new Map(clients.map((c) => [c.id, c.company || c.name]));

    for (const inv of invs) {
      const date = inv.createdAt ?? new Date();
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      // group this invoice's items by VAT rate → gross per rate
      const grossByRate = new Map<number, number>();
      for (const it of itemsByInv.get(inv.id) ?? []) {
        const net = it.unitPriceCents * it.quantity;
        const tax = Math.round((net * it.taxRate) / 100);
        grossByRate.set(it.taxRate, (grossByRate.get(it.taxRate) ?? 0) + net + tax);
      }
      for (const [rate, grossCents] of grossByRate) {
        if (grossCents <= 0) continue;
        bookings.push({
          date,
          invoiceNumber: inv.invoiceNumber || inv.id,
          grossCents,
          account: DEBITOR,
          counterAccount: ERLOES[rate] ?? '8400',
          buKey: '',
          text: `${inv.title} ${clientName.get(inv.clientId) ?? ''}`.trim(),
        });
      }
    }
  }

  const now = new Date();
  const from = minDate ?? new Date(now.getFullYear(), 0, 1);
  const to = maxDate ?? new Date(now.getFullYear(), 11, 31);
  const agency = (await db.select({ name: agencies.name }).from(agencies).where(eq(agencies.id, session.agencyId)).limit(1))[0];
  const meta: DatevMeta = {
    fiscalYearStart: new Date(from.getFullYear(), 0, 1),
    from, to, name: agency?.name,
  };

  const csv = buildDatevExtf(bookings, meta);
  // DATEV expects Windows-1252 (ANSI). Our generated content is Latin-1-safe; map per-char to bytes.
  const bytes = new Uint8Array(csv.length);
  for (let i = 0; i < csv.length; i++) bytes[i] = csv.charCodeAt(i) & 0xff;

  return new Response(bytes, {
    headers: {
      'Content-Type': 'text/csv; charset=windows-1252',
      'Content-Disposition': `attachment; filename="${datevFilename(meta)}"`,
    },
  });
}
