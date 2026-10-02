import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import {
  agencies, agencyUsers, clientUsers, userPermissions, userRoles, rolePermissions,
  type Agency, type AgencyUser, type ClientUser,
} from '@/lib/db';
import { createAuth } from './index';
import { computePermissions, type PermissionKey, type AgencyRole } from '@/lib/permissions';
import { provisionUserOnCreate } from './provision';

export interface AgencySession {
  kind: 'agency';
  authUserId: string;
  user: AgencyUser;
  agency: Agency;
  agencyId: string;
  permissions: Set<PermissionKey>;
}

export interface PortalSession {
  kind: 'client';
  authUserId: string;
  client: ClientUser;
  agency: Agency;
  agencyId: string;
}

export type EnrichedSession = AgencySession | PortalSession;

/** Resolve the full domain session (cached per request). */
export const getEnrichedSession = cache(async (): Promise<EnrichedSession | null> => {
  const db = await getRequestDb();
  const auth = createAuth(db);
  const session = await auth.api.getSession({ headers: await headers() });
  const authUser = session?.user;
  if (!authUser?.email) return null;
  const email = authUser.email.toLowerCase();

  let au = await db.query.agencyUsers.findFirst({ where: eq(agencyUsers.email, email) });
  let cu = au ? null : await db.query.clientUsers.findFirst({ where: eq(clientUsers.email, email) });

  // Self-heal: an authenticated user with no domain record is treated as a
  // fresh agency owner (covers hook failures / pre-existing accounts).
  if (!au && !cu) {
    await provisionUserOnCreate(db, { id: authUser.id, email, name: authUser.name });
    au = await db.query.agencyUsers.findFirst({ where: eq(agencyUsers.email, email) });
    cu = au ? null : await db.query.clientUsers.findFirst({ where: eq(clientUsers.email, email) });
  }

  if (au) {
    const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, au.agencyId) });
    if (!agency) return null;
    const [overrides, roleRows] = await Promise.all([
      db.query.userPermissions.findMany({ where: eq(userPermissions.userId, au.id) }),
      db.select({ permission: rolePermissions.permission })
        .from(userRoles)
        .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
        .where(eq(userRoles.userId, au.id)),
    ]);
    const assignedRolePerms = roleRows.map((r) => r.permission);
    const permissions = computePermissions(au.role as AgencyRole, assignedRolePerms, overrides);
    return { kind: 'agency', authUserId: authUser.id, user: au, agency, agencyId: agency.id, permissions };
  }

  if (cu) {
    const agency = await db.query.agencies.findFirst({ where: eq(agencies.id, cu.agencyId) });
    if (!agency) return null;
    return { kind: 'client', authUserId: authUser.id, client: cu, agency, agencyId: agency.id };
  }

  return null;
});

export async function requireAgencySession(): Promise<AgencySession> {
  const s = await getEnrichedSession();
  if (!s) throw new Error('UNAUTHORIZED');
  if (s.kind !== 'agency') throw new Error('FORBIDDEN');
  return s;
}

export async function requirePortalSession(): Promise<PortalSession> {
  const s = await getEnrichedSession();
  if (!s) throw new Error('UNAUTHORIZED');
  if (s.kind !== 'client') throw new Error('FORBIDDEN');
  return s;
}

/** Throws FORBIDDEN if an agency session lacks a permission. */
export function assertCan(session: AgencySession, action: PermissionKey): void {
  if (!session.permissions.has(action)) throw new Error('FORBIDDEN');
}
