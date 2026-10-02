import { redirect } from 'next/navigation';
import { requireAgencySession } from '@/lib/auth/session';
import { getAgencyDashboard } from './queries';
import { DashboardView } from './dashboard-view';

export default async function DashboardPage() {
  const session = await requireAgencySession();
  // First-run nudge: send brand-new agencies through the 3-step onboarding.
  if (!session.agency.onboardedAt) redirect('/app/a/onboarding');
  const data = await getAgencyDashboard(session.agencyId);

  return (
    <DashboardView
      data={data}
      agencyName={session.agency.name}
      userName={session.user.name}
    />
  );
}
