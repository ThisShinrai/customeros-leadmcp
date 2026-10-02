'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { invoices } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { sendInvoiceReminder } from '@/lib/invoices/reminders';

/** Agency-triggered dunning: send the next Zahlungserinnerung / Mahnung. */
export async function sendReminder(invoiceId: string): Promise<{ ok: boolean; level?: number; reason?: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:release');
  const db = await getRequestDb();
  const inv = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.agencyId, s.agencyId)) });
  if (!inv) return { ok: false, reason: 'NOT_FOUND' };
  const res = await sendInvoiceReminder(db, invoiceId, { actorId: s.user.id, actorName: s.user.name });
  revalidatePath('/app/a/invoices');
  return res;
}
