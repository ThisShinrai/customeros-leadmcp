'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { LEAD_STATUSES } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import {
  createLead, updateLead, deleteLead, addLeadNote, convertLeadToClient, runSiteCheck,
} from '@/lib/leads/core';

const LeadSchema = z.object({
  company: z.string().trim().min(1, 'Firma erforderlich').max(160),
  contactName: z.string().trim().max(120).optional(),
  contactRole: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(60).optional(),
  phoneAlt: z.string().trim().max(60).optional(),
  email: z.string().trim().max(200).optional().refine((v) => !v || /.+@.+\..+/.test(v), 'Ungültige E-Mail'),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(120).optional(),
  googleRating: z.string().trim().max(80).optional(),
  websiteUrl: z.string().trim().max(300).optional(),
  socialLinks: z.string().max(1500).optional(),
  techStack: z.string().trim().max(300).optional(),
  siteAge: z.string().trim().max(300).optional(),
  siteBuiltBy: z.string().trim().max(160).optional(),
  siteBuiltByUrl: z.string().trim().max(300).optional(),
  source: z.string().trim().max(120).optional(),
  analysis: z.string().max(8000).optional(),
  recommendation: z.string().max(4000).optional(),
  estimatedCents: z.number().int().min(0).nullable().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  starred: z.boolean().optional(),
  nextActionOn: z.string().max(40).nullable().optional(),
  doNotCall: z.boolean().optional(),
  assignedTo: z.string().max(60).nullable().optional(),
});

function parseDates<T extends { nextActionOn?: string | null }>(data: T) {
  return {
    ...data,
    nextActionOn: data.nextActionOn === undefined ? undefined : data.nextActionOn ? new Date(data.nextActionOn) : null,
  };
}

export async function createLeadAction(input: unknown) {
  const s = await requireAgencySession();
  assertCan(s, 'leads:manage');
  const data = LeadSchema.parse(input);
  const db = await getRequestDb();
  const lead = await createLead(db, s.agencyId, parseDates(data));
  revalidatePath('/app/a/leads');
  return { id: lead.id };
}

export async function updateLeadAction(id: string, input: unknown) {
  const s = await requireAgencySession();
  assertCan(s, 'leads:manage');
  const data = LeadSchema.partial().parse(input);
  const db = await getRequestDb();
  await updateLead(db, s.agencyId, id, parseDates(data), s.user.name);
  revalidatePath('/app/a/leads');
  return { ok: true };
}

export async function deleteLeadAction(id: string) {
  const s = await requireAgencySession();
  assertCan(s, 'leads:manage');
  const db = await getRequestDb();
  await deleteLead(db, s.agencyId, id);
  revalidatePath('/app/a/leads');
  return { ok: true };
}

export async function addLeadNoteAction(leadId: string, note: string) {
  const s = await requireAgencySession();
  assertCan(s, 'leads:manage');
  const text = z.string().trim().min(1).max(4000).parse(note);
  const db = await getRequestDb();
  await addLeadNote(db, s.agencyId, leadId, text, s.user.name);
  revalidatePath('/app/a/leads');
  return { ok: true };
}

export async function convertLeadAction(leadId: string) {
  const s = await requireAgencySession();
  assertCan(s, 'leads:manage');
  assertCan(s, 'clients:invite');
  const db = await getRequestDb();
  const res = await convertLeadToClient(db, s.agencyId, leadId);
  await addLeadNote(db, s.agencyId, leadId, res.created ? 'Als Kunde übernommen.' : 'Mit bestehendem Kunden verknüpft.', s.user.name);
  revalidatePath('/app/a/leads');
  revalidatePath('/app/a/clients');
  return res;
}

export async function siteCheckAction(leadId: string) {
  const s = await requireAgencySession();
  assertCan(s, 'leads:manage');
  const db = await getRequestDb();
  const result = await runSiteCheck(db, s.agencyId, leadId);
  revalidatePath('/app/a/leads');
  return result;
}
