'use client';

import { ErrorState } from '@/components/error-state';

export default function PortalProjekteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Ihre Projekte konnten nicht geladen werden. Bitte versuchen Sie es erneut."
    />
  );
}
