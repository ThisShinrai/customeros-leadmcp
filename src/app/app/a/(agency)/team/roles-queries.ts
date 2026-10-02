import { eq, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { roles, rolePermissions, userRoles } from '@/lib/db';
import type { PermissionKey } from '@/lib/permissions';

export interface RoleItem {
  id: string;
  name: string;
  isDefault: boolean;
  permissions: PermissionKey[];
  userCount: number;
}

export async function listRoles(agencyId: string): Promise<RoleItem[]> {
  const db = await getRequestDb();
  const roleRows = await db.select().from(roles).where(eq(roles.agencyId, agencyId));
  const ids = roleRows.map((r) => r.id);
  if (ids.length === 0) return [];

  const [perms, assignments] = await Promise.all([
    db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, ids)),
    db.select({ roleId: userRoles.roleId }).from(userRoles).where(inArray(userRoles.roleId, ids)),
  ]);
  const byRole = new Map<string, PermissionKey[]>();
  for (const p of perms) {
    const arr = byRole.get(p.roleId) ?? [];
    arr.push(p.permission as PermissionKey);
    byRole.set(p.roleId, arr);
  }
  const counts = new Map<string, number>();
  for (const a of assignments) counts.set(a.roleId, (counts.get(a.roleId) ?? 0) + 1);

  return roleRows.map((r) => ({
    id: r.id, name: r.name, isDefault: r.isDefault,
    permissions: byRole.get(r.id) ?? [],
    userCount: counts.get(r.id) ?? 0,
  }));
}

/** Map of agency_user id → assigned role ids. */
export async function getUserRoleMap(userIds: string[]): Promise<Record<string, string[]>> {
  if (userIds.length === 0) return {};
  const db = await getRequestDb();
  const rows = await db.select().from(userRoles).where(inArray(userRoles.userId, userIds));
  const map: Record<string, string[]> = {};
  for (const r of rows) (map[r.userId] ??= []).push(r.roleId);
  return map;
}
