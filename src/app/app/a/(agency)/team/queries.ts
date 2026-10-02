import { and, eq, asc, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { agencyUsers, type AgencyUser } from '@/lib/db';
import { ROLE_LABELS, type AgencyRole } from '@/lib/permissions';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AgencyRole;
  roleLabel: string;
  status: AgencyUser['status'];
  createdAt: Date | null;
}

export interface TeamData {
  members: TeamMember[];
  invites: TeamMember[];
}

function toTeamMember(u: AgencyUser): TeamMember {
  const role = u.role as AgencyRole;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    roleLabel: ROLE_LABELS[role],
    status: u.status,
    createdAt: u.createdAt,
  };
}

/** Owner first, then oldest-created first. */
function byOwnerThenCreated(a: TeamMember, b: TeamMember): number {
  if (a.role === 'owner' && b.role !== 'owner') return -1;
  if (b.role === 'owner' && a.role !== 'owner') return 1;
  const at = a.createdAt ? a.createdAt.getTime() : 0;
  const bt = b.createdAt ? b.createdAt.getTime() : 0;
  return at - bt;
}

export async function listTeam(agencyId: string): Promise<TeamData> {
  const db = await getRequestDb();
  const rows = await db
    .select()
    .from(agencyUsers)
    .where(
      and(
        eq(agencyUsers.agencyId, agencyId),
        inArray(agencyUsers.status, ['active', 'inactive', 'invited']),
      ),
    )
    .orderBy(asc(agencyUsers.createdAt));

  const members: TeamMember[] = [];
  const invites: TeamMember[] = [];
  for (const u of rows) {
    if (u.status === 'invited') invites.push(toTeamMember(u));
    else members.push(toTeamMember(u));
  }

  members.sort(byOwnerThenCreated);
  invites.sort(byOwnerThenCreated);

  return { members, invites };
}
