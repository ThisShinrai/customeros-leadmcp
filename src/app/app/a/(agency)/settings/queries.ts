import { and, desc, eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { agencies, agencyUsers, auditLogs, type AuditLog } from '@/lib/db';
import { ensureSupportCredentials } from '@/lib/support/credentials';

export interface AgencySettings {
  name: string;
  slug: string;
  logo: string | null;
  accentColor: string | null;
  loginBgColor: string | null;
  portalAccentText: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  taxId: string | null;
  // E-Rechnung (EN 16931): SEPA payment details + structured legal address.
  iban: string | null;
  bic: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  customDomain: string | null;
  plan: 'free' | 'starter' | 'pro' | 'business';
  teamAdsDisabled: boolean;
  /** Always present (lazily generated). Safe to show to any team member. */
  customerNumber: string;
  /** Secret — only populated for the agency owner. */
  supportPin: string | null;
}

export interface UserSettings {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  avatarFrameColor: string | null;
  bio: string | null;
  role: string;
  emailFrequency: 'sofort' | 'nie';
}

export interface SettingsData {
  agency: AgencySettings;
  user: UserSettings;
}

/** Load the agency white-label/profile row plus the current agency_user's profile. */
export async function getSettings(agencyId: string, userId: string): Promise<SettingsData | null> {
  const db = await getRequestDb();

  const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, agencyId) });
  if (!agency) return null;

  // Tenant isolation: the user must belong to this agency.
  const user = await db.query.agencyUsers.findFirst({
    where: and(eq(agencyUsers.id, userId), eq(agencyUsers.agencyId, agencyId)),
  });
  if (!user) return null;

  const { customerNumber, supportPin } = await ensureSupportCredentials(db, agency);
  const isOwner = user.role === 'owner';

  return {
    agency: {
      name: agency.name,
      slug: agency.slug,
      logo: agency.logo,
      accentColor: agency.accentColor,
      loginBgColor: agency.loginBgColor,
      portalAccentText: agency.portalAccentText,
      contactEmail: agency.contactEmail,
      phone: agency.phone,
      website: agency.website,
      address: agency.address,
      taxId: agency.taxId,
      iban: agency.iban,
      bic: agency.bic,
      street: agency.street,
      zip: agency.zip,
      city: agency.city,
      country: agency.country,
      customDomain: agency.customDomain,
      plan: agency.plan,
      teamAdsDisabled: agency.teamAdsDisabled,
      customerNumber,
      supportPin: isOwner ? supportPin : null,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      avatarFrameColor: user.avatarFrameColor,
      bio: user.bio,
      role: user.role,
      emailFrequency: user.emailFrequency,
    },
  };
}

/* ─── Audit-Log ───────────────────────────────────────────────────── */

export interface AuditLogEntry {
  id: string;
  action: string;
  actorName: string | null;
  targetType: string | null;
  /** Epoch ms (for client-side relative formatting). */
  createdAt: number | null;
}

/** Newest-first slice of the agency's audit trail. Tenant-isolated by agencyId. */
export async function getAuditLog(agencyId: string, limit = 100): Promise<AuditLogEntry[]> {
  const db = await getRequestDb();
  const rows: AuditLog[] = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.agencyId, agencyId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actorName,
    targetType: r.targetType,
    createdAt: r.createdAt ? new Date(r.createdAt).getTime() : null,
  }));
}
