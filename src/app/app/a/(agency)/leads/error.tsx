'use client';

import { ErrorState } from '@/components/error-state';

export default function LeadsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Die Leads konnten nicht geladen werden. Versuchen Sie es erneut oder kehren Sie zum Dashboard zurück."
      backHref="/app/a/dashboard"
      backLabel="Zum Dashboard"
    />
  );
}
