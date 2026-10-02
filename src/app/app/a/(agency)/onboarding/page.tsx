import { redirect } from 'next/navigation';
import { requireAgencySession } from '@/lib/auth/session';
import { OnboardingWizard } from './onboarding-wizard';

export default async function OnboardingPage() {
  const session = await requireAgencySession();
  if (session.agency.onboardedAt) redirect('/app/a/dashboard');

  return (
    <OnboardingWizard
      agencyName={session.agency.name}
      accentColor={session.agency.accentColor || '#0A0A0A'}
      logo={session.agency.logo}
    />
  );
}
