import { notFound } from 'next/navigation';
import { requirePortalSession } from '@/lib/auth/session';
import { getClientProposalDetail } from '../../proposal-actions';
import { ProposalSignView } from './proposal-sign-view';

export default async function PortalProposalDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const session = await requirePortalSession();
  const detail = await getClientProposalDetail(id);
  if (!detail) notFound();

  return (
    <ProposalSignView
      slug={slug}
      detail={detail}
      clientName={session.client.name}
      avatarUrl={session.client.avatarUrl}
      avatarFrameColor={session.client.avatarFrameColor}
      agencyName={session.agency.name}
      agencyLogo={session.agency.logo}
    />
  );
}
