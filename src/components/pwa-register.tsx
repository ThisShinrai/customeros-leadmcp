'use client';

import { useEffect } from 'react';

/** Registers the service worker once on the client (enables install + push). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
