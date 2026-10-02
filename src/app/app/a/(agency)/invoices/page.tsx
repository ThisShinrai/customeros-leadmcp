import { requireAgencySession } from '@/lib/auth/session';
import { listInvoices, invoiceStats, listInvoiceFormData } from './queries';
import { InvoicesView } from './invoices-view';

export default async function InvoicesPage() {
  const session = await requireAgencySession();
  const [invoices, stats, formData] = await Promise.all([
    listInvoices(session.agencyId),
    invoiceStats(session.agencyId),
    listInvoiceFormData(session.agencyId),
  ]);

  return (
    <InvoicesView
      invoices={invoices}
      stats={stats}
      formData={formData}
      canCreate={session.permissions.has('invoices:create')}
    />
  );
}
