'use client';

/**
 * Deprecated on mobile: navigation now lives in the thumb-reachable bottom bar
 * (`MobileBottomNav`), so the top-left hamburger is gone. Kept as a no-op so the
 * many header call-sites don't need touching. Renders nothing on every viewport.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function NavToggle(_props: { tone?: 'light' | 'dark' }) {
  return null;
}
