'use client';

import { ErrorState } from '@/components/error-state';

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Die Einstellungen konnten nicht geladen werden. Versuchen Sie es erneut oder kehren Sie zu den Einstellungen zurück."
      backHref="/app/a/settings"
      backLabel="Zu den Einstellungen"
    />
  );
}
