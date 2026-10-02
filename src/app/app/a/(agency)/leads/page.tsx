import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { listAgencyLeads } from './queries';
import { LeadsView } from './leads-view';

export default async function LeadsPage() {
  const session = await requireAgencySession();
  assertCan(session, 'leads:view');
  const leads = await listAgencyLeads(session.agencyId);

  return (
    <LeadsView
      leads={leads}
      canManage={session.permissions.has('leads:manage')}
    />
  );
}
