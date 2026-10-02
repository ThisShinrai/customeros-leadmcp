'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb, type Db } from '@/lib/db';
import {
  agencyUsers, clientUsers, userRoles, userPermissions, projectMembers,
  type AgencyUser,
} from '@/lib/db';
import { requireAgencySession, assertCan, type AgencySession } from '@/lib/auth/session';
import { sendInviteMagicLink } from '@/lib/auth/invite';
import { logAudit } from '@/lib/audit';
import { getPlanLimits } from '@/lib/plans';

/** Load a team member and verify it belongs to the session's agency. */
async function assertMember(db: Db, userId: string, session: AgencySession): Promise<AgencyUser> {
  const member = await db.query.agencyUsers.findFirst({
    where: and(eq(agencyUsers.id, userId), eq(agencyUsers.agencyId, session.agencyId)),
  });
  if (!member) throw new Error('NOT_FOUND');
  return member;
}

/* ─────────────────────────── Invite ─────────────────────────── */

const InviteSchema = z.object({
  email: z.string().trim().email('Ungültige E-Mail-Adresse').max(200),
  name: z.string().trim().min(1, 'Name erforderlich').max(120),
  role: z.enum(['admin', 'member']),
});

export async function inviteMember(input: unknown) {
  const session = await requireAgencySession();
  assertCan(session, 'team:invite');
  const data = InviteSchema.parse(input);
  const email = data.email.toLowerCase();
  const db = await getRequestDb();

  const existing = await db.query.agencyUsers.findFirst({
    where: and(eq(agencyUsers.email, email), eq(agencyUsers.agencyId, session.agencyId)),
  });
  if (existing) throw new Error('ALREADY_EXISTS');

  // One email = one identity: an existing client of this agency must not be
  // invited into the team — the provisioning hook would silently pick one side.
  const existingClient = await db.query.clientUsers.findFirst({ where: and(eq(clientUsers.email, email), eq(clientUsers.agencyId, session.agencyId)) });
  if (existingClient) throw new Error('IS_CLIENT');

  const memberCount = (await db.select({ id: agencyUsers.id }).from(agencyUsers).where(eq(agencyUsers.agencyId, session.agencyId))).length;
  if (memberCount >= getPlanLimits(session.agency.plan).teamMembers) throw new Error('Team-Limit deines Tarifs erreicht — bitte upgraden.');

  const [created] = await db.insert(agencyUsers).values({
    agencyId: session.agencyId,
    email,
    name: data.name,
    role: data.role,
    status: 'invited',
  }).returning();

  await logAudit(db, {
    agencyId: session.agencyId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: 'team.invited',
    targetType: 'agency_user',
    targetId: created.id,
    meta: { email, role: data.role },
  });

  await sendInviteMagicLink(email, '/app/a/dashboard');

  revalidatePath('/app/a/team');
  return { ok: true };
}

/* ─────────────────────────── Change role ─────────────────────────── */

const ChangeRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'member']),
});

export async function changeRole(userId: string, role: 'admin' | 'member') {
  const session = await requireAgencySession();
  assertCan(session, 'team:roles');
  const data = ChangeRoleSchema.parse({ userId, role });
  const db = await getRequestDb();

  const member = await assertMember(db, data.userId, session);
  if (member.role === 'owner') throw new Error('FORBIDDEN');

  await db.update(agencyUsers)
    .set({ role: data.role, updatedAt: new Date() })
    .where(eq(agencyUsers.id, data.userId));

  await logAudit(db, {
    agencyId: session.agencyId,
    actorId: session.user.id,
    actorName: session.user.name,
    action: 'team.role_changed',
    targetType: 'agency_user',
    targetId: data.userId,
    meta: { from: member.role, to: data.role },
  });

  revalidatePath('/app/a/team');
  return { ok: true };
}

/* ─────────────────────────── Activate / deactivate ─────────────────────────── */

const SetStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['active', 'inactive']),
});

export async function setMemberStatus(userId: string, status: 'active' | 'inactive') {
  const session = await requireAgencySession();
  assertCan(session, 'team:remove');
  const data = SetStatusSchema.parse({ userId, status });
  const db = await getRequestDb();

  const member = await assertMember(db, data.userId, session);
  if (member.role === 'owner') throw new Error('FORBIDDEN');

  await db.update(agencyUsers)
    .set({ status: data.status, updatedAt: new Date() })
    .where(eq(agencyUsers.id, data.userId));

  revalidatePath('/app/a/team');
  return { ok: true };
}

/* ─────────────────────────── Remove ─────────────────────────── */

export async function removeMember(userId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'team:remove');
  const db = await getRequestDb();

  const member = await assertMember(db, userId, session);
  if (member.role === 'owner') throw new Error('FORBIDDEN');
  if (member.id === session.user.id) throw new Error('FORBIDDEN');

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  await db.delete(projectMembers).where(eq(projectMembers.userId, userId));
  await db.delete(agencyUsers).where(eq(agencyUsers.id, userId));

  revalidatePath('/app/a/team');
  return { ok: true };
}

/* ─────────────────────────── Resend invite ─────────────────────────── */

export async function resendInvite(userId: string) {
  const session = await requireAgencySession();
  assertCan(session, 'team:invite');
  const db = await getRequestDb();

  const member = await assertMember(db, userId, session);
  if (member.status !== 'invited') throw new Error('NOT_INVITED');

  await sendInviteMagicLink(member.email, '/app/a/dashboard');

  revalidatePath('/app/a/team');
  return { ok: true };
}
