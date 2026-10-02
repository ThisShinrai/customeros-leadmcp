import { requireAgencySession } from '@/lib/auth/session';
import { listAgencyAppointments } from './queries';
import { AppointmentsView } from './appointments-view';

export default async function AppointmentsPage() {
  const session = await requireAgencySession();
  const appointments = await listAgencyAppointments(session.agencyId);

  return (
    <AppointmentsView
      appointments={appointments}
      canEdit={session.permissions.has('projects:edit')}
    />
  );
}
