'use client';

import { ErrorState } from '@/components/error-state';

export default function PortalAngeboteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Ihre Angebote konnten nicht geladen werden. Bitte versuchen Sie es erneut."
    />
  );
}
