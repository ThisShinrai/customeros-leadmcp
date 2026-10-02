import { notFound } from 'next/navigation';
import { requireAgencySession } from '@/lib/auth/session';
import { getInvoiceDetail, listInvoiceFormData } from '../queries';
import { InvoiceDetailView } from './invoice-detail-view';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAgencySession();
  const [detail, formData] = await Promise.all([
    getInvoiceDetail(id, session.agencyId),
    listInvoiceFormData(session.agencyId),
  ]);
  if (!detail) notFound();

  return (
    <InvoiceDetailView
      detail={detail}
      formData={formData}
      canRelease={session.permissions.has('invoices:release')}
      canDelete={session.permissions.has('invoices:delete')}
      canCreate={session.permissions.has('invoices:create')}
    />
  );
}
