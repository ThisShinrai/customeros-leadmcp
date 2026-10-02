'use client';

import { relativeTime } from '@/lib/utils';

/**
 * Renders a relative timestamp ("vor 3 Min.") in a hydration-safe way.
 * Relative times depend on the current clock, so the server-rendered and
 * client-hydrated values can differ by a minute — suppressHydrationWarning
 * keeps the server value and avoids the mismatch error.
 */
export function TimeAgo({ value }: { value: Date | number | string | null | undefined }) {
  const v = value == null ? null : typeof value === 'string' ? new Date(value) : value;
  return <span suppressHydrationWarning>{relativeTime(v)}</span>;
}
