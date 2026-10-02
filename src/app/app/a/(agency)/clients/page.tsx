import { requireAgencySession } from '@/lib/auth/session';
import { listClients } from './queries';
import { ClientsView } from './clients-view';

export default async function ClientsPage() {
  const session = await requireAgencySession();
  const clients = await listClients(session.agencyId);

  return (
    <ClientsView
      clients={clients}
      canInvite={session.permissions.has('clients:invite')}
      canManage={session.permissions.has('clients:disable') || session.permissions.has('clients:edit')}
    />
  );
}
