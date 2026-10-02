'use client';

import { ErrorState } from '@/components/error-state';

export default function TeamError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Das Team konnte nicht geladen werden. Versuchen Sie es erneut oder kehren Sie zur Teamübersicht zurück."
      backHref="/app/a/team"
      backLabel="Zum Team"
    />
  );
}
