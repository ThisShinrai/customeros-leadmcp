import { requireAgencySession } from '@/lib/auth/session';
import { listTeam } from './queries';
import { listRoles, getUserRoleMap } from './roles-queries';
import { TeamView } from './team-view';

export default async function TeamPage() {
  const session = await requireAgencySession();
  const data = await listTeam(session.agencyId);

  const memberIds = data.members.map((m) => m.id);
  const [roles, userRoleMap] = await Promise.all([
    listRoles(session.agencyId),
    getUserRoleMap(memberIds),
  ]);

  return (
    <TeamView
      data={data}
      roles={roles}
      userRoleMap={userRoleMap}
      canManage={session.permissions.has('team:invite')}
      canManageRoles={session.permissions.has('team:roles')}
      currentUserId={session.user.id}
    />
  );
}
