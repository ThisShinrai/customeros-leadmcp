import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { agencies, agencyUsers, clientUsers, roles, rolePermissions } from '@/lib/db';
import { slugify, shortId } from '@/lib/utils';
import { ROLE_PERMISSIONS, type PermissionKey } from '@/lib/permissions';
import { generateCustomerNumber, generateSupportPin } from '@/lib/support/credentials';

/**
 * Runs after a BetterAuth user is created. Links the auth user to the right
 * domain record based on pre-existing invite rows, or provisions a brand-new
 * agency when there is no pending invite (= agency owner self-signup).
 */
export async function provisionUserOnCreate(
  db: Db,
  user: { id: string; email: string; name?: string | null },
): Promise<void> {
  const email = user.email.toLowerCase();

  // (a) Pending/existing agency team member → activate.
  const existingAgencyUser = await db.query.agencyUsers.findFirst({ where: eq(agencyUsers.email, email) });
  if (existingAgencyUser) {
    if (existingAgencyUser.status === 'invited') {
      await db
        .update(agencyUsers)
        .set({ status: 'active', inviteToken: null, updatedAt: new Date() })
        .where(eq(agencyUsers.id, existingAgencyUser.id));
    }
    return;
  }

  // (b) Pending client invite → enable portal + stamp login.
  const existingClient = await db.query.clientUsers.findFirst({ where: eq(clientUsers.email, email) });
  if (existingClient) {
    await db
      .update(clientUsers)
      .set({ portalEnabled: true, lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(clientUsers.id, existingClient.id));
    return;
  }

  // (c) No invite → new agency owner.
  await createAgencyForOwner(db, { name: user.name || 'Meine Agentur', email });
}

export async function createAgencyForOwner(
  db: Db,
  { name, email }: { name: string; email: string },
): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const clash = await db.query.agencies.findFirst({ where: eq(agencies.slug, slug) });
    if (!clash) break;
    slug = `${base}-${shortId(4)}`;
  }

  const [agency] = await db
    .insert(agencies)
    .values({
      name, slug, accentColor: '#0A0A0A', plan: 'free',
      customerNumber: generateCustomerNumber(),
      supportPin: generateSupportPin(),
    })
    .returning();

  await db.insert(agencyUsers).values({
    agencyId: agency.id,
    email,
    name,
    role: 'owner',
    status: 'active',
  });

  await seedDefaultRoles(db, agency.id);
  return agency.id;
}

async function seedDefaultRoles(db: Db, agencyId: string): Promise<void> {
  const defs: { name: string; perms: PermissionKey[] }[] = [
    { name: 'CEO / Inhaber', perms: ROLE_PERMISSIONS.owner },
    { name: 'Projektleiter', perms: ROLE_PERMISSIONS.admin },
    { name: 'Mitarbeiter', perms: ROLE_PERMISSIONS.member },
  ];
  for (const d of defs) {
    const [r] = await db.insert(roles).values({ agencyId, name: d.name, isDefault: true }).returning();
    if (d.perms.length) {
      await db.insert(rolePermissions).values(d.perms.map((p) => ({ roleId: r.id, permission: p })));
    }
  }
}
