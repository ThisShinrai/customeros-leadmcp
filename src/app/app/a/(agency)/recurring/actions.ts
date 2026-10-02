'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { recurringInvoices, clientUsers, projects } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { assertPlanFeature } from '@/lib/plans';
import { generateFromRecurring } from '@/lib/invoices/jobs';

const ItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(100000),
  unitPriceCents: z.number().int().min(0),
  taxRate: z.number().int().min(0).max(100),
});

const SaveSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(2000).optional().or(z.literal('')),
  intervalMonths: z.number().int().min(1).max(12),
  nextRunAt: z.string().datetime(),
  autoRelease: z.boolean(),
  items: z.array(ItemSchema).min(1, 'Mindestens eine Position'),
});

async function assertTenant(db: Awaited<ReturnType<typeof getRequestDb>>, agencyId: string, clientId: string, projectId: string) {
  const client = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.id, clientId), eq(clientUsers.agencyId, agencyId)) });
  if (!client) throw new Error('NOT_FOUND');
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, projectId), eq(projects.agencyId, agencyId)) });
  if (!project) throw new Error('NOT_FOUND');
}

export async function createRecurring(input: unknown): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  assertPlanFeature(s.agency.plan, 'invoices');
  const data = SaveSchema.parse(input);
  const db = await getRequestDb();
  await assertTenant(db, s.agencyId, data.clientId, data.projectId);
  await db.insert(recurringInvoices).values({
    agencyId: s.agencyId, clientId: data.clientId, projectId: data.projectId,
    title: data.title, notes: data.notes || null,
    items: JSON.stringify(data.items),
    intervalMonths: data.intervalMonths, nextRunAt: new Date(data.nextRunAt),
    autoRelease: data.autoRelease, active: true,
  });
  revalidatePath('/app/a/recurring');
  return { ok: true };
}

export async function updateRecurring(id: string, input: unknown): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const data = SaveSchema.parse(input);
  const db = await getRequestDb();
  const row = await db.query.recurringInvoices.findFirst({ where: and(eq(recurringInvoices.id, id), eq(recurringInvoices.agencyId, s.agencyId)) });
  if (!row) throw new Error('NOT_FOUND');
  await assertTenant(db, s.agencyId, data.clientId, data.projectId);
  await db.update(recurringInvoices).set({
    clientId: data.clientId, projectId: data.projectId, title: data.title, notes: data.notes || null,
    items: JSON.stringify(data.items), intervalMonths: data.intervalMonths, nextRunAt: new Date(data.nextRunAt),
    autoRelease: data.autoRelease, updatedAt: new Date(),
  }).where(eq(recurringInvoices.id, id));
  revalidatePath('/app/a/recurring');
  return { ok: true };
}

export async function setRecurringActive(id: string, active: boolean): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const db = await getRequestDb();
  const row = await db.query.recurringInvoices.findFirst({ where: and(eq(recurringInvoices.id, id), eq(recurringInvoices.agencyId, s.agencyId)) });
  if (!row) throw new Error('NOT_FOUND');
  await db.update(recurringInvoices).set({ active, updatedAt: new Date() }).where(eq(recurringInvoices.id, id));
  revalidatePath('/app/a/recurring');
  return { ok: true };
}

export async function deleteRecurring(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const db = await getRequestDb();
  const row = await db.query.recurringInvoices.findFirst({ where: and(eq(recurringInvoices.id, id), eq(recurringInvoices.agencyId, s.agencyId)) });
  if (!row) throw new Error('NOT_FOUND');
  await db.delete(recurringInvoices).where(eq(recurringInvoices.id, id));
  revalidatePath('/app/a/recurring');
  return { ok: true };
}

/** Generate one invoice from the template right now (and advance its schedule). */
export async function runRecurringNow(id: string): Promise<{ ok: boolean; invoiceId?: string }> {
  const s = await requireAgencySession();
  assertCan(s, 'invoices:create');
  const db = await getRequestDb();
  const row = await db.query.recurringInvoices.findFirst({ where: and(eq(recurringInvoices.id, id), eq(recurringInvoices.agencyId, s.agencyId)) });
  if (!row) return { ok: false };
  const invoiceId = await generateFromRecurring(db, row);
  revalidatePath('/app/a/recurring');
  revalidatePath('/app/a/invoices');
  return { ok: !!invoiceId, invoiceId: invoiceId ?? undefined };
}
