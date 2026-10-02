'use client';

import { ErrorState } from '@/components/error-state';

export default function PortalWhiteboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      description="Das Whiteboard konnte nicht geladen werden. Bitte versuchen Sie es erneut."
    />
  );
}
