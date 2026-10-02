import { notFound } from 'next/navigation';
import { requirePortalSession } from '@/lib/auth/session';
import { isStripeConfigured } from '@/lib/stripe';
import { getClientInvoiceDetail } from '../../queries';
import { PortalInvoiceView } from './portal-invoice-view';

export default async function PortalInvoiceDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const session = await requirePortalSession();
  const [detail, paymentEnabled] = await Promise.all([
    getClientInvoiceDetail(session.agencyId, session.client.id, id),
    isStripeConfigured(),
  ]);
  if (!detail) notFound();

  return (
    <PortalInvoiceView
      detail={detail}
      slug={slug}
      clientName={session.client.name}
      avatarUrl={session.client.avatarUrl}
      avatarFrameColor={session.client.avatarFrameColor}
      paymentEnabled={paymentEnabled}
    />
  );
}
