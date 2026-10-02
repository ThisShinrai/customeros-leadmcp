'use client';

import { ErrorState } from '@/components/error-state';

export default function ClientsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Die Kunden konnten nicht geladen werden. Versuchen Sie es erneut oder kehren Sie zur Kundenübersicht zurück."
      backHref="/app/a/clients"
      backLabel="Zu den Kunden"
    />
  );
}
