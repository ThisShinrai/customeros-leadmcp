import { requireAgencySession } from '@/lib/auth/session';
import { getTimeData } from './queries';
import { TimeView } from './time-view';

export default async function TimePage() {
  const session = await requireAgencySession();
  const data = await getTimeData(session.agencyId);

  return (
    <TimeView
      data={data}
      canEdit={session.permissions.has('projects:edit')}
      canBill={session.permissions.has('invoices:create')}
    />
  );
}
