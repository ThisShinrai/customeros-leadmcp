'use client';

import { ErrorState } from '@/components/error-state';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Das Dashboard konnte nicht geladen werden. Bitte versuchen Sie es erneut."
    />
  );
}
