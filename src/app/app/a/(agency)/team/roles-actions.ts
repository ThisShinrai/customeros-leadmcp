'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import { roles, rolePermissions, userRoles, agencyUsers } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit';
import { PERMISSION_KEYS, type PermissionKey } from '@/lib/permissions';

const PermSchema = z.array(z.enum(PERMISSION_KEYS)).default([]);

async function assertRole(db: Db, roleId: string, agencyId: string) {
  const role = await db.query.roles.findFirst({ where: and(eq(roles.id, roleId), eq(roles.agencyId, agencyId)) });
  if (!role) throw new Error('NOT_FOUND');
  return role;
}

async function replacePermissions(db: Db, roleId: string, perms: PermissionKey[]) {
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  if (perms.length) await db.insert(rolePermissions).values(perms.map((p) => ({ roleId, permission: p })));
}

export async function createRole(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'team:roles');
  const data = z.object({ name: z.string().trim().min(1, 'Name erforderlich').max(60), permissions: PermSchema }).parse(input);
  const db = await getRequestDb();
  const [role] = await db.insert(roles).values({ agencyId: session.agencyId, name: data.name, isDefault: false }).returning();
  await replacePermissions(db, role.id, data.permissions);
  revalidatePath('/app/a/team');
  return { id: role.id };
}

export async function updateRole(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'team:roles');
  const data = z.object({ id: z.string(), name: z.string().trim().min(1).max(60).optional(), permissions: PermSchema.optional() }).parse(input);
  const db = await getRequestDb();
  await assertRole(db, data.id, session.agencyId);
  if (data.name !== undefined) await db.update(roles).set({ name: data.name }).where(eq(roles.id, data.id));
  if (data.permissions !== undefined) await replacePermissions(db, data.id, data.permissions);
  revalidatePath('/app/a/team');
  return { ok: true };
}

export async function duplicateRole(roleId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'team:roles');
  const db = await getRequestDb();
  const role = await assertRole(db, roleId, session.agencyId);
  const perms = await db.select({ permission: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  const [copy] = await db.insert(roles).values({ agencyId: session.agencyId, name: `${role.name} (Kopie)`, isDefault: false }).returning();
  if (perms.length) await db.insert(rolePermissions).values(perms.map((p) => ({ roleId: copy.id, permission: p.permission })));
  revalidatePath('/app/a/team');
  return { id: copy.id };
}

export async function deleteRole(roleId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'team:roles');
  const db = await getRequestDb();
  await assertRole(db, roleId, session.agencyId);
  const assigned = await db.query.userRoles.findFirst({ where: eq(userRoles.roleId, roleId) });
  if (assigned) throw new Error('ROLE_IN_USE');
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  await db.delete(roles).where(eq(roles.id, roleId));
  revalidatePath('/app/a/team');
  return { ok: true };
}

export async function setUserRoles(userId: string, roleIds: string[]) {
  const session = await requireAgencySession();
  assertCan(session, 'team:roles');
  const db = await getRequestDb();
  // Tenant check: user + all roles belong to this agency.
  const user = await db.query.agencyUsers.findFirst({ where: and(eq(agencyUsers.id, userId), eq(agencyUsers.agencyId, session.agencyId)) });
  if (!user) throw new Error('NOT_FOUND');
  if (user.role === 'owner') throw new Error('FORBIDDEN'); // owner is always super-admin
  for (const rid of roleIds) await assertRole(db, rid, session.agencyId);

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  if (roleIds.length) await db.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId })));

  await logAudit(db, {
    agencyId: session.agencyId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: 'team.roles_assigned',
    targetType: 'agency_user',
    targetId: userId,
    meta: { roleIds },
  });

  revalidatePath('/app/a/team');
  return { ok: true };
}
