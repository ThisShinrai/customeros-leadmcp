import { and, desc, eq, like, or } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { leads, leadNotes, clientUsers, LEAD_STATUSES, type Lead, type LeadNote, type LeadStatus } from '@/lib/db';

/**
 * Session-lose Lead-Logik — geteilt von den Server Actions (UI) und dem
 * MCP-Endpoint (/api/mcp). Tenant-Isolation: jede Funktion nimmt agencyId
 * und filtert strikt darauf.
 */

export interface LeadInput {
  company: string;
  contactName?: string;
  contactRole?: string;
  phone?: string;
  phoneAlt?: string;
  email?: string;
  address?: string;
  city?: string;
  industry?: string;
  googleRating?: string;
  websiteUrl?: string;
  socialLinks?: string;
  techStack?: string;
  siteAge?: string;
  siteBuiltBy?: string;
  siteBuiltByUrl?: string;
  source?: string;
  analysis?: string;
  recommendation?: string;
  estimatedCents?: number | null;
  status?: LeadStatus;
  starred?: boolean;
  nextActionOn?: Date | null;
  doNotCall?: boolean;
  assignedTo?: string | null;
}

export function isLeadStatus(s: string): s is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(s);
}

export async function listLeads(db: Db, agencyId: string, opts: { status?: LeadStatus; search?: string; limit?: number } = {}): Promise<Lead[]> {
  const conds = [eq(leads.agencyId, agencyId)];
  if (opts.status) conds.push(eq(leads.status, opts.status));
  if (opts.search) {
    const q = `%${opts.search}%`;
    conds.push(or(like(leads.company, q), like(leads.city, q), like(leads.email, q), like(leads.contactName, q))!);
  }
  return db.select().from(leads).where(and(...conds)).orderBy(desc(leads.updatedAt)).limit(opts.limit ?? 500);
}

export async function getLead(db: Db, agencyId: string, id: string): Promise<(Lead & { notes: LeadNote[] }) | null> {
  const lead = await db.query.leads.findFirst({ where: and(eq(leads.id, id), eq(leads.agencyId, agencyId)) });
  if (!lead) return null;
  const notes = await db.select().from(leadNotes).where(eq(leadNotes.leadId, id)).orderBy(desc(leadNotes.createdAt)).limit(100);
  return { ...lead, notes };
}

export async function createLead(db: Db, agencyId: string, input: LeadInput): Promise<Lead> {
  const [lead] = await db.insert(leads).values({
    agencyId,
    company: input.company.trim(),
    contactName: input.contactName?.trim() ?? '',
    contactRole: input.contactRole?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    phoneAlt: input.phoneAlt?.trim() ?? '',
    email: input.email?.trim().toLowerCase() ?? '',
    address: input.address?.trim() ?? '',
    city: input.city?.trim() ?? '',
    industry: input.industry?.trim() ?? '',
    googleRating: input.googleRating?.trim() ?? '',
    websiteUrl: input.websiteUrl?.trim() ?? '',
    socialLinks: input.socialLinks?.trim() ?? '',
    techStack: input.techStack?.trim() ?? '',
    siteAge: input.siteAge?.trim() ?? '',
    siteBuiltBy: input.siteBuiltBy?.trim() ?? '',
    siteBuiltByUrl: input.siteBuiltByUrl?.trim() ?? '',
    source: input.source?.trim() ?? '',
    analysis: input.analysis ?? '',
    recommendation: input.recommendation ?? '',
    estimatedCents: input.estimatedCents ?? null,
    status: input.status ?? 'neu',
    starred: input.starred ?? false,
    nextActionOn: input.nextActionOn ?? null,
    doNotCall: input.doNotCall ?? false,
    assignedTo: input.assignedTo ?? null,
  }).returning();
  return lead;
}

export async function updateLead(
  db: Db, agencyId: string, id: string,
  patch: Partial<LeadInput> & { attempts?: number },
  actorName = '',
): Promise<Lead> {
  const existing = await db.query.leads.findFirst({ where: and(eq(leads.id, id), eq(leads.agencyId, agencyId)) });
  if (!existing) throw new Error('NOT_FOUND');

  const [updated] = await db.update(leads).set({
    ...(patch.company !== undefined ? { company: patch.company.trim() } : {}),
    ...(patch.contactName !== undefined ? { contactName: patch.contactName.trim() } : {}),
    ...(patch.contactRole !== undefined ? { contactRole: patch.contactRole.trim() } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
    ...(patch.phoneAlt !== undefined ? { phoneAlt: patch.phoneAlt.trim() } : {}),
    ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
    ...(patch.address !== undefined ? { address: patch.address.trim() } : {}),
    ...(patch.city !== undefined ? { city: patch.city.trim() } : {}),
    ...(patch.industry !== undefined ? { industry: patch.industry.trim() } : {}),
    ...(patch.googleRating !== undefined ? { googleRating: patch.googleRating.trim() } : {}),
    ...(patch.websiteUrl !== undefined ? { websiteUrl: patch.websiteUrl.trim() } : {}),
    ...(patch.socialLinks !== undefined ? { socialLinks: patch.socialLinks.trim() } : {}),
    ...(patch.techStack !== undefined ? { techStack: patch.techStack.trim() } : {}),
    ...(patch.siteAge !== undefined ? { siteAge: patch.siteAge.trim() } : {}),
    ...(patch.siteBuiltBy !== undefined ? { siteBuiltBy: patch.siteBuiltBy.trim() } : {}),
    ...(patch.siteBuiltByUrl !== undefined ? { siteBuiltByUrl: patch.siteBuiltByUrl.trim() } : {}),
    ...(patch.source !== undefined ? { source: patch.source.trim() } : {}),
    ...(patch.analysis !== undefined ? { analysis: patch.analysis } : {}),
    ...(patch.recommendation !== undefined ? { recommendation: patch.recommendation } : {}),
    ...(patch.estimatedCents !== undefined ? { estimatedCents: patch.estimatedCents } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.starred !== undefined ? { starred: patch.starred } : {}),
    ...(patch.nextActionOn !== undefined ? { nextActionOn: patch.nextActionOn } : {}),
    ...(patch.doNotCall !== undefined ? { doNotCall: patch.doNotCall } : {}),
    ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
    ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
    updatedAt: new Date(),
  }).where(eq(leads.id, id)).returning();

  if (patch.status !== undefined && patch.status !== existing.status) {
    await addLeadNote(db, agencyId, id, `Status: ${existing.status} → ${patch.status}`, actorName);
  }
  return updated;
}

export async function addLeadNote(db: Db, agencyId: string, leadId: string, note: string, authorName = ''): Promise<LeadNote> {
  const lead = await db.query.leads.findFirst({ where: and(eq(leads.id, leadId), eq(leads.agencyId, agencyId)) });
  if (!lead) throw new Error('NOT_FOUND');
  const [row] = await db.insert(leadNotes).values({ leadId, note, authorName }).returning();
  return row;
}

export async function deleteLead(db: Db, agencyId: string, id: string): Promise<void> {
  const lead = await db.query.leads.findFirst({ where: and(eq(leads.id, id), eq(leads.agencyId, agencyId)) });
  if (!lead) throw new Error('NOT_FOUND');
  await db.delete(leadNotes).where(eq(leadNotes.leadId, id));
  await db.delete(leads).where(eq(leads.id, id));
}

/**
 * Lead → Kunde: legt einen client_users-Datensatz an (ohne Portal-Einladung —
 * die schickt man bewusst separat) und verlinkt ihn am Lead. Idempotent.
 */
export async function convertLeadToClient(db: Db, agencyId: string, leadId: string): Promise<{ clientId: string; created: boolean }> {
  const lead = await db.query.leads.findFirst({ where: and(eq(leads.id, leadId), eq(leads.agencyId, agencyId)) });
  if (!lead) throw new Error('NOT_FOUND');
  if (lead.convertedClientId) return { clientId: lead.convertedClientId, created: false };

  // E-Mail-Kollision: existiert die Adresse schon als Kunde, verlinken statt anlegen.
  let client = lead.email
    ? await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.email, lead.email), eq(clientUsers.agencyId, agencyId)) })
    : undefined;
  let created = false;
  if (!client) {
    if (!lead.email) throw new Error('NO_EMAIL');
    [client] = await db.insert(clientUsers).values({
      agencyId,
      email: lead.email,
      name: lead.contactName || lead.company,
      company: lead.company,
      city: lead.city || null,
      portalEnabled: false,
    }).returning();
    created = true;
  }
  await db.update(leads).set({ convertedClientId: client.id, updatedAt: new Date() }).where(eq(leads.id, leadId));
  return { clientId: client.id, created };
}

/* ─────────────────── Website-Check (aus dem Sales Manager portiert) ─────────────────── */

export interface SiteCheckResult {
  url: string;
  ok: boolean;
  https: boolean;
  loadMs: number;
  sizeKb: number;
  hasViewport: boolean;
  title: string;
  description: string;
  hasImpressum: boolean;
  hasDatenschutz: boolean;
  hasContact: boolean;
  score: number;
  findings: { label: string; ok: boolean; wert?: string }[];
  error?: string;
}

/** HTTP-Abruf mit einfachen Heuristiken — Ergebnis wird als JSON am Lead gespeichert. */
export async function runSiteCheck(db: Db, agencyId: string, leadId: string): Promise<SiteCheckResult> {
  const lead = await db.query.leads.findFirst({ where: and(eq(leads.id, leadId), eq(leads.agencyId, agencyId)) });
  if (!lead) throw new Error('NOT_FOUND');
  if (!lead.websiteUrl) throw new Error('NO_URL');

  let url = lead.websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  let result: SiteCheckResult;
  try {
    const t0 = Date.now();
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; epssys-sitecheck/1.0)' } });
    const html = (await res.text()).slice(0, 500_000);
    const loadMs = Date.now() - t0;
    const lower = html.toLowerCase();

    const https = res.url.startsWith('https://');
    const hasViewport = lower.includes('name="viewport"') || lower.includes("name='viewport'");
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
    const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1]?.trim() ?? '';
    const hasImpressum = lower.includes('impressum');
    const hasDatenschutz = lower.includes('datenschutz');
    const hasContact = lower.includes('kontakt') || lower.includes('contact');
    const sizeKb = Math.round(html.length / 1024);

    const findings: SiteCheckResult['findings'] = [
      { label: 'HTTPS', ok: https },
      { label: 'Ladezeit', ok: loadMs < 3000, wert: `${loadMs} ms` },
      { label: 'Mobiltauglich (Viewport)', ok: hasViewport },
      { label: 'Seitentitel', ok: title.length > 5, wert: title || '—' },
      { label: 'Meta-Beschreibung', ok: description.length > 20 },
      { label: 'Impressum', ok: hasImpressum },
      { label: 'Datenschutz', ok: hasDatenschutz },
      { label: 'Kontaktmöglichkeit', ok: hasContact },
    ];
    const score = Math.round((findings.filter((f) => f.ok).length / findings.length) * 100);
    result = { url: res.url, ok: res.ok, https, loadMs, sizeKb, hasViewport, title, description, hasImpressum, hasDatenschutz, hasContact, score, findings };
  } catch (e) {
    result = {
      url, ok: false, https: false, loadMs: 0, sizeKb: 0, hasViewport: false, title: '', description: '',
      hasImpressum: false, hasDatenschutz: false, hasContact: false, score: 0, findings: [],
      error: e instanceof Error ? e.message : 'Abruf fehlgeschlagen',
    };
  }

  await db.update(leads).set({ siteCheck: JSON.stringify(result), siteCheckedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId));
  return result;
}
