'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { agencies, agencyUsers } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';
import { assertPlanFeature } from '@/lib/plans';

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_IMAGE_BYTES = 256 * 1024; // 256 KB

function revalidateSettings() {
  revalidatePath('/app/a/settings');
  revalidatePath('/app/a/dashboard');
}

/** Read an uploaded image File into a base64 data URL (Edge-compatible, no fs/Node Buffer). */
async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('TOO_LARGE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const type = file.type || 'image/png';
  return `data:${type};base64,${base64}`;
}

/* ─── Agentur-Profil ──────────────────────────────────────────────── */

const AgencyProfileSchema = z.object({
  name: z.string().trim().min(1, 'Agenturname erforderlich').max(160),
  contactEmail: z.string().trim().email('Ungültige E-Mail').max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(60).optional().or(z.literal('')),
  website: z.string().trim().max(200).optional().or(z.literal('')),
  address: z.string().trim().max(400).optional().or(z.literal('')),
  taxId: z.string().trim().max(60).optional().or(z.literal('')),
  // E-Rechnung (EN 16931): SEPA payment details + structured legal address.
  iban: z.string().trim().max(34).optional().or(z.literal('')),
  bic: z.string().trim().max(11).optional().or(z.literal('')),
  street: z.string().trim().max(160).optional().or(z.literal('')),
  zip: z.string().trim().max(12).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  country: z.string().trim().max(2).optional().or(z.literal('')),
});

export async function updateAgencyProfile(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'settings:profile');
  const data = AgencyProfileSchema.parse(input);
  const db = await getRequestDb();

  await db.update(agencies).set({
    name: data.name,
    contactEmail: data.contactEmail ? data.contactEmail.toLowerCase() : null,
    phone: data.phone || null,
    website: data.website || null,
    address: data.address || null,
    taxId: data.taxId || null,
    iban: data.iban ? data.iban.replace(/\s+/g, '').toUpperCase() : null,
    bic: data.bic ? data.bic.replace(/\s+/g, '').toUpperCase() : null,
    street: data.street || null,
    zip: data.zip || null,
    city: data.city || null,
    country: data.country ? data.country.toUpperCase() : 'DE',
    updatedAt: new Date(),
  }).where(eq(agencies.id, session.agencyId));

  revalidateSettings();
  return { ok: true };
}

/* ─── White-Label ─────────────────────────────────────────────────── */

/** Optional hex color: empty string or a valid #RRGGBB (→ stored as null when empty). */
const OptionalHex = z.string().trim().regex(HEX, 'Ungültige Farbe (z. B. #FF6B00)').optional().or(z.literal(''));

const WhiteLabelSchema = z.object({
  accentColor: z.string().trim().regex(HEX, 'Ungültige Farbe (z. B. #FF6B00)'),
  loginBgColor: OptionalHex,
  portalAccentText: OptionalHex,
  customDomain: z.string().trim().max(200).optional().or(z.literal('')),
});

export async function updateWhiteLabel(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'settings:whitelabel');
  assertPlanFeature(session.agency.plan, 'whiteLabel');
  const data = WhiteLabelSchema.parse(input);
  if (data.customDomain) assertPlanFeature(session.agency.plan, 'customDomain');
  const db = await getRequestDb();

  await db.update(agencies).set({
    accentColor: data.accentColor.toUpperCase(),
    loginBgColor: data.loginBgColor ? data.loginBgColor.toUpperCase() : null,
    portalAccentText: data.portalAccentText ? data.portalAccentText.toUpperCase() : null,
    customDomain: data.customDomain || null,
    updatedAt: new Date(),
  }).where(eq(agencies.id, session.agencyId));

  await logAudit(db, {
    agencyId: session.agencyId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: 'settings.whitelabel_updated',
    targetType: 'agency',
    targetId: session.agencyId,
    meta: { accentColor: data.accentColor.toUpperCase() },
  });

  revalidateSettings();
  return { ok: true };
}

/**
 * Best-effort check whether a tenant's custom domain already routes to us.
 * Fetches the domain and looks for the `x-epssys-portal` header our middleware
 * sets when it resolves a custom domain to this agency's portal.
 */
export async function verifyCustomDomain(rawDomain: string): Promise<{ reachable: boolean; routed: boolean }> {
  const session = await requireAgencySession();
  assertCan(session, 'settings:whitelabel');
  const host = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
  if (!host || !host.includes('.')) return { reachable: false, routed: false };
  try {
    const res = await fetch(`https://${host}/`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': 'epssys-domain-check' },
    });
    const routed = res.headers.get('x-epssys-portal') === session.agency.slug;
    return { reachable: true, routed };
  } catch {
    return { reachable: false, routed: false };
  }
}

export async function uploadLogo(formData: FormData) {
  const session = await requireAgencySession();
  assertCan(session, 'settings:whitelabel');

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) throw new Error('NO_FILE');
  const dataUrl = await fileToDataUrl(file);

  const db = await getRequestDb();
  await db.update(agencies).set({ logo: dataUrl, updatedAt: new Date() }).where(eq(agencies.id, session.agencyId));

  revalidateSettings();
  return { ok: true };
}

/* ─── Mein Profil (eigenes agency_user-Profil) ────────────────────── */

const UserProfileSchema = z.object({
  name: z.string().trim().min(1, 'Anzeigename erforderlich').max(120),
  bio: z.string().trim().max(400).optional().or(z.literal('')),
  avatarFrameColor: z.string().trim().regex(HEX, 'Ungültige Farbe').optional().or(z.literal('')),
});

export async function updateUserProfile(input: unknown) {
  // Own profile — no special permission required.
  const session = await requireAgencySession();
  const data = UserProfileSchema.parse(input);
  const db = await getRequestDb();

  await db.update(agencyUsers).set({
    name: data.name,
    bio: data.bio || null,
    avatarFrameColor: data.avatarFrameColor ? data.avatarFrameColor.toUpperCase() : null,
    updatedAt: new Date(),
  }).where(and(eq(agencyUsers.id, session.user.id), eq(agencyUsers.agencyId, session.agencyId)));

  revalidateSettings();
  return { ok: true };
}

export async function uploadAvatar(formData: FormData) {
  const session = await requireAgencySession();

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) throw new Error('NO_FILE');
  const dataUrl = await fileToDataUrl(file);

  const db = await getRequestDb();
  await db.update(agencyUsers).set({ avatarUrl: dataUrl, updatedAt: new Date() })
    .where(and(eq(agencyUsers.id, session.user.id), eq(agencyUsers.agencyId, session.agencyId)));

  revalidateSettings();
  return { ok: true };
}
