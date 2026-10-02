'use server';

import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { timeEntries, projects, projectClients } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { createInvoiceWithItems } from '@/lib/invoices/create';
import type { InvoicePdfItem } from '@/lib/pdf/invoice-pdf';

const LogSchema = z.object({
  projectId: z.string().min(1),
  description: z.string().trim().min(1, 'Beschreibung fehlt').max(300),
  minutes: z.number().int().positive().max(100000),
  occurredAt: z.string().datetime(),
  billable: z.boolean(),
  rateCents: z.number().int().min(0).max(100000000).optional(),
});

export async function logTime(input: unknown): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const data = LogSchema.parse(input);
  const db = await getRequestDb();
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, data.projectId), eq(projects.agencyId, s.agencyId)) });
  if (!project) throw new Error('NOT_FOUND');
  await db.insert(timeEntries).values({
    agencyId: s.agencyId, projectId: data.projectId, userId: s.user.id, userName: s.user.name,
    description: data.description, minutes: data.minutes, occurredAt: new Date(data.occurredAt),
    billable: data.billable, rateCents: data.rateCents ?? null,
  });
  revalidatePath('/app/a/time');
  return { ok: true };
}

export async function deleteTime(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  const row = await db.query.timeEntries.findFirst({ where: and(eq(timeEntries.id, id), eq(timeEntries.agencyId, s.agencyId)) });
  if (!row) throw new Error('NOT_FOUND');
  if (row.invoiceId) throw new Error('Bereits abgerechnete Einträge können nicht gelöscht werden.');
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
  revalidatePath('/app/a/time');
  return { ok: true };
}

const BillSchema = z.object({
  projectId: z.string().min(1),
  defaultRateCents: z.number().int().min(0).max(100000000),
  taxRate: z.number().int().min(0).max(100),
  title: z.string().trim().max(160).optional().or(z.literal('')),
});

/** Bundle all unbilled, billable entries of a project into one draft invoice. */
export async function billTime(input: unknown): Promise<{ ok: boolean; invoiceId?: string; reason?: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const data = BillSchema.parse(input);
  const db = await getRequestDb();

  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, data.projectId), eq(projects.agencyId, s.agencyId)) });
  if (!project) return { ok: false, reason: 'NOT_FOUND' };

  const link = await db.query.projectClients.findFirst({ where: eq(projectClients.projectId, data.projectId) });
  if (!link) return { ok: false, reason: 'NO_CLIENT' };

  const entries = await db.select().from(timeEntries).where(and(
    eq(timeEntries.agencyId, s.agencyId), eq(timeEntries.projectId, data.projectId),
    eq(timeEntries.billable, true), isNull(timeEntries.invoiceId),
  ));
  if (entries.length === 0) return { ok: false, reason: 'NOTHING' };

  const items: InvoicePdfItem[] = entries.map((e) => {
    const hours = e.minutes / 60;
    const rate = e.rateCents ?? data.defaultRateCents;
    return {
      description: `${e.description} (${hours.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Std.)`,
      quantity: 1,
      unitPriceCents: Math.round(hours * rate),
      taxRate: data.taxRate,
    };
  });

  const { id } = await createInvoiceWithItems(db, {
    agencyId: s.agencyId, clientId: link.clientId, projectId: data.projectId,
    title: data.title || `Leistungen — ${project.name}`, items,
  });

  const ids = entries.map((e) => e.id);
  for (const eid of ids) {
    await db.update(timeEntries).set({ invoiceId: id }).where(eq(timeEntries.id, eid));
  }

  revalidatePath('/app/a/time');
  revalidatePath('/app/a/invoices');
  return { ok: true, invoiceId: id };
}
