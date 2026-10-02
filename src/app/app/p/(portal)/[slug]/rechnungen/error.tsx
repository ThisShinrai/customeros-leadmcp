'use client';

import { ErrorState } from '@/components/error-state';

export default function PortalRechnungenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Ihre Rechnungen konnten nicht geladen werden. Bitte versuchen Sie es erneut."
    />
  );
}
