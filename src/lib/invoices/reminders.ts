import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { invoices, agencies } from '@/lib/db';
import { notifyClient } from '@/lib/email/notify';
import { logAudit } from '@/lib/audit';
import { fmtEuro, fmtDate } from '@/lib/invoices/format';

const LEVELS = [
  { label: 'Zahlungserinnerung', tone: 'freundliche Erinnerung' },
  { label: '1. Mahnung', tone: 'erste Mahnung' },
  { label: '2. Mahnung', tone: 'zweite Mahnung' },
];

/**
 * Send the next dunning level for an invoice (Zahlungserinnerung → 1. Mahnung →
 * 2. Mahnung, capped). Session-less so the agency action and the cron can both
 * use it. Bumps reminderLevel + lastReminderAt and flips an overdue invoice.
 */
export async function sendInvoiceReminder(
  db: Db,
  invoiceId: string,
  opts?: { actorId?: string | null; actorName?: string },
): Promise<{ ok: boolean; level?: number; reason?: string }> {
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
  if (!inv) return { ok: false, reason: 'NOT_FOUND' };
  if (inv.status === 'paid') return { ok: false, reason: 'PAID' };
  if (!inv.visibleToClient) return { ok: false, reason: 'NOT_RELEASED' };

  const level = Math.min((inv.reminderLevel ?? 0) + 1, 3);
  const meta = LEVELS[level - 1];
  const overdue = inv.dueDate ? inv.dueDate.getTime() < Date.now() : false;

  await db.update(invoices).set({
    reminderLevel: level,
    lastReminderAt: new Date(),
    ...(overdue && inv.status !== 'overdue' ? { status: 'overdue' as const } : {}),
    updatedAt: new Date(),
  }).where(eq(invoices.id, invoiceId));

  const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, inv.agencyId) });
  const due = inv.dueDate ? ` (Fälligkeit war der ${fmtDate(inv.dueDate)})` : '';
  await notifyClient(db, {
    clientId: inv.clientId, agencyId: inv.agencyId,
    heading: `${meta.label}: Rechnung ${inv.invoiceNumber ?? ''}`.trim(),
    body: `Dies ist eine ${meta.tone} zur noch offenen Rechnung${inv.invoiceNumber ? ` ${inv.invoiceNumber}` : ''} über ${fmtEuro(inv.totalAmount)}${due}. Bitte begleichen Sie den Betrag zeitnah.`,
    path: `/app/p/${agency?.slug ?? ''}/rechnungen/${invoiceId}`,
    ctaLabel: 'Rechnung öffnen',
  });

  await logAudit(db, {
    agencyId: inv.agencyId,
    actorId: opts?.actorId ?? null,
    actorName: opts?.actorName ?? 'System',
    action: 'invoice.reminded',
    targetType: 'invoice',
    targetId: invoiceId,
    meta: { level, label: meta.label, invoiceNumber: inv.invoiceNumber },
  });

  return { ok: true, level };
}
