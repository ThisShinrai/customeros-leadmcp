import { requireAgencySession } from '@/lib/auth/session';
import { listInvoiceFormData } from '@/app/app/a/(agency)/invoices/queries';
import { listProposals } from './queries';
import { ProposalsView } from './proposals-view';

export default async function ProposalsPage() {
  const session = await requireAgencySession();
  const [proposals, formData] = await Promise.all([
    listProposals(session.agencyId),
    listInvoiceFormData(session.agencyId),
  ]);

  return (
    <ProposalsView
      proposals={proposals}
      formData={formData}
      canEdit={session.permissions.has('invoices:create')}
    />
  );
}
