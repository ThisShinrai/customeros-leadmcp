import { requirePortalSession } from '@/lib/auth/session';
import { PortalHeader } from '@/components/portal/portal-header';
import { getPortalAppointments } from '../appointment-portal-actions';
import { TermineView } from './termine-view';

export default async function PortalTerminePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requirePortalSession();
  const { available, mine } = await getPortalAppointments();

  return (
    <div className="page-transition">
      <PortalHeader
        title="Termine"
        subtitle={`${available.length} freie${available.length === 1 ? 'r' : ''} Slot${available.length === 1 ? '' : 's'}`}
        clientName={session.client.name}
        avatarUrl={session.client.avatarUrl}
        avatarFrameColor={session.client.avatarFrameColor}
      />

      <TermineView slug={slug} available={available} mine={mine} />
    </div>
  );
}
