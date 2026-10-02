import { requireAgencySession } from '@/lib/auth/session';
import { listInvoiceFormData } from '@/app/app/a/(agency)/invoices/queries';
import { listRecurring } from './queries';
import { RecurringView } from './recurring-view';

export default async function RecurringPage() {
  const session = await requireAgencySession();
  const [recurring, formData] = await Promise.all([
    listRecurring(session.agencyId),
    listInvoiceFormData(session.agencyId),
  ]);

  return (
    <RecurringView
      recurring={recurring}
      clients={formData.clients}
      projects={formData.projects}
      canEdit={session.permissions.has('invoices:create')}
    />
  );
}
