'use client';

import { ErrorState } from '@/components/error-state';

export default function PortalProfilError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Ihr Profil konnte nicht geladen werden. Bitte versuchen Sie es erneut."
    />
  );
}
