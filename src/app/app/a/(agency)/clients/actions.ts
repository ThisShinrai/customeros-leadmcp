'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { agencyUsers, clientUsers, projectClients, chatParticipants, invoices } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { sendInviteMagicLink } from '@/lib/auth/invite';
import { logAudit } from '@/lib/audit';
import { getPlanLimits } from '@/lib/plans';
import { dispatchWebhook } from '@/lib/webhooks';

async function assertClient(db: Db, clientId: string, agencyId: string) {
  const client = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.id, clientId), eq(clientUsers.agencyId, agencyId)) });
  if (!client) throw new Error('NOT_FOUND');
  return client;
}

// Shared E-Rechnung (EN 16931) buyer fields — postal address + VAT ID, all optional.
const EInvoiceFields = {
  street: z.string().trim().max(160).optional().or(z.literal('')),
  zip: z.string().trim().max(12).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  country: z.string().trim().max(2).optional().or(z.literal('')),
  vatId: z.string().trim().max(40).optional().or(z.literal('')),
};

const InviteSchema = z.object({
  name: z.string().trim().min(1, 'Name erforderlich').max(120),
  email: z.string().trim().email('Ungültige E-Mail').max(200),
  company: z.string().trim().max(160).optional(),
  ...EInvoiceFields,
});

export async function inviteClient(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'clients:invite');
  const data = InviteSchema.parse(input);
  const email = data.email.toLowerCase();
  const db = await getRequestDb();

  const existing = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.email, email), eq(clientUsers.agencyId, session.agencyId)) });
  if (existing) throw new Error('ALREADY_EXISTS');

  // One email = one identity: the provisioning hook resolves agency_users first,
  // so a team member's email must never double as a client (and vice versa).
  const teamMember = await db.query.agencyUsers.findFirst({ where: and(eq(agencyUsers.email, email), eq(agencyUsers.agencyId, session.agencyId)) });
  if (teamMember) throw new Error('IS_TEAM_MEMBER');

  const clientCount = (await db.select({ id: clientUsers.id }).from(clientUsers).where(eq(clientUsers.agencyId, session.agencyId))).length;
  if (clientCount >= getPlanLimits(session.agency.plan).clients) throw new Error('Kunden-Limit deines Tarifs erreicht — bitte upgraden.');

  const [created] = await db.insert(clientUsers).values({
    agencyId: session.agencyId,
    email,
    name: data.name,
    company: data.company || null,
    street: data.street || null,
    zip: data.zip || null,
    city: data.city || null,
    country: data.country ? data.country.toUpperCase() : 'DE',
    vatId: data.vatId || null,
    portalEnabled: false,
  }).returning();

  await logAudit(db, {
    agencyId: session.agencyId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: 'client.invited',
    targetType: 'client',
    targetId: created.id,
    meta: { email },
  });

  await sendInviteMagicLink(email, `/app/p/${session.agency.slug}`);
  await dispatchWebhook(db, session.agencyId, 'client.created', { id: created.id, email, name: data.name });
  revalidatePath('/app/a/clients');
  return { ok: true, id: created.id };
}

export async function setPortalAccess(clientId: string, enabled: boolean) {
  const session = await requireAgencySession();
  assertCan(session, 'clients:disable');
  const db = await getRequestDb();
  await assertClient(db, clientId, session.agencyId);
  await db.update(clientUsers).set({ portalEnabled: enabled, updatedAt: new Date() }).where(eq(clientUsers.id, clientId));
  revalidatePath('/app/a/clients');
  return { ok: true };
}

export async function reInviteClient(clientId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'clients:invite');
  const db = await getRequestDb();
  const client = await assertClient(db, clientId, session.agencyId);
  await sendInviteMagicLink(client.email, `/app/p/${session.agency.slug}`);
  revalidatePath('/app/a/clients');
  return { ok: true };
}

const UpdateClientSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120).optional(),
  company: z.string().trim().max(160).nullable().optional(),
  ...EInvoiceFields,
});

export async function updateClient(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'clients:edit');
  const data = UpdateClientSchema.parse(input);
  const db = await getRequestDb();
  await assertClient(db, data.id, session.agencyId);
  await db.update(clientUsers).set({
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.company !== undefined ? { company: data.company } : {}),
    // E-Rechnung (EN 16931): empty string clears the field; country falls back to 'DE'.
    ...(data.street !== undefined ? { street: data.street || null } : {}),
    ...(data.zip !== undefined ? { zip: data.zip || null } : {}),
    ...(data.city !== undefined ? { city: data.city || null } : {}),
    ...(data.country !== undefined ? { country: data.country ? data.country.toUpperCase() : 'DE' } : {}),
    ...(data.vatId !== undefined ? { vatId: data.vatId || null } : {}),
    updatedAt: new Date(),
  }).where(eq(clientUsers.id, data.id));
  revalidatePath('/app/a/clients');
  return { ok: true };
}

export async function deleteClient(clientId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'clients:edit');
  const db = await getRequestDb();
  await assertClient(db, clientId, session.agencyId);

  // Guard: clients with invoices can't be hard-deleted (would orphan financial records).
  const hasInvoice = await db.query.invoices.findFirst({ where: eq(invoices.clientId, clientId) });
  if (hasInvoice) throw new Error('HAS_INVOICES');

  await db.delete(projectClients).where(eq(projectClients.clientId, clientId));
  await db.delete(chatParticipants).where(eq(chatParticipants.participantId, clientId));
  await db.delete(clientUsers).where(eq(clientUsers.id, clientId));
  revalidatePath('/app/a/clients');
  return { ok: true };
}
